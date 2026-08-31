import { Logger, Scope } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import {
  StepStatus,
  type WorkflowRunStepInfo,
} from 'twenty-shared/workflow';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { MetricsKeys } from 'src/engine/core-modules/metrics/types/metrics-keys.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { CodeStepBuildService } from 'src/modules/workflow/workflow-builder/workflow-version-step/code-step/services/code-step-build.service';
import { isWorkflowIteratorAction } from 'src/modules/workflow/workflow-executor/workflow-actions/iterator/guards/is-workflow-iterator-action.guard';
import { WorkflowExecutorWorkspaceService } from 'src/modules/workflow/workflow-executor/workspace-services/workflow-executor.workspace-service';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';
import { WorkflowTriggerType } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

@Processor({ queueName: MessageQueue.workflowQueue, scope: Scope.REQUEST })
export class RunWorkflowJob {
  private readonly logger = new Logger(RunWorkflowJob.name);

  constructor(
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly codeStepBuildService: CodeStepBuildService,
    private readonly workflowExecutorWorkspaceService: WorkflowExecutorWorkspaceService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly metricsService: MetricsService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
  ) {}

  @Process(RUN_WORKFLOW_JOB_NAME)
  async handle({
    workflowRunId,
    lastExecutedStepId,
    stepIdsToRetry,
    workspaceId,
  }: RunWorkflowJobData): Promise<void> {
    this.logger.log(
      `Running workflow run ${workflowRunId} in workspace ${workspaceId}`,
    );
    const authContext = buildSystemAuthContext(workspaceId);

    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      try {
        if (isDefined(stepIdsToRetry)) {
          await this.retryWorkflowExecution({
            workspaceId,
            workflowRunId,
            stepIdsToRetry,
          });
        } else if (lastExecutedStepId) {
          await this.resumeWorkflowExecution({
            workspaceId,
            workflowRunId,
            lastExecutedStepId,
          });
        } else {
          await this.startWorkflowExecution({
            workflowRunId,
            workspaceId,
          });
        }
      } catch (error) {
        await this.workflowRunWorkspaceService.endWorkflowRun({
          workspaceId,
          workflowRunId,
          status: WorkflowRunStatus.FAILED,
          error: error.message,
          isSystemError: true,
        });

        throw error;
      }
    }, authContext);
  }

  private async startWorkflowExecution({
    workflowRunId,
    workspaceId,
  }: {
    workflowRunId: string;
    workspaceId: string;
  }): Promise<void> {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    if (
      workflowRun.status !== WorkflowRunStatus.ENQUEUED &&
      workflowRun.status !== WorkflowRunStatus.NOT_STARTED
    ) {
      // A start job re-delivered for a RUNNING run means the previous worker
      // died mid-execution (BullMQ stalled re-delivery). Returning here would
      // strand the run at RUNNING forever, so recover the in-flight steps
      // instead of abandoning them.
      if (workflowRun.status === WorkflowRunStatus.RUNNING) {
        await this.recoverInFlightExecution({
          workflowRunId,
          workspaceId,
        });
      }

      return;
    }

    const workflowVersion =
      await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
        workspaceId,
        workflowVersionId: workflowRun.workflowVersionId,
      });

    if (!workflowVersion.trigger || !workflowVersion.steps) {
      throw new WorkflowRunException(
        'Workflow version has no trigger or steps',
        WorkflowRunExceptionCode.WORKFLOW_RUN_INVALID,
      );
    }

    await this.codeStepBuildService.buildCodeStepsFromSourceForSteps({
      workspaceId,
      steps: workflowVersion.steps,
    });

    await this.workflowRunWorkspaceService.startWorkflowRun({
      workflowRunId,
      workspaceId,
    });

    await this.incrementTriggerMetrics({
      workflowRunId,
      triggerType: workflowVersion.trigger.type,
    });

    const stepIds = workflowVersion.trigger.nextStepIds ?? [];

    await this.workflowExecutorWorkspaceService.executeFromSteps({
      stepIds,
      workflowRunId,
      workspaceId,
    });
  }

  // A worker that dies mid-run (OOM, deploy, restart) leaves steps at RUNNING
  // with no job to finish them; BullMQ re-delivers the start job once, which
  // used to no-op. Re-executing the in-flight steps lets the re-delivery
  // resume the run instead of stranding it at RUNNING until the staled-runs
  // cron fails it an hour later.
  private async recoverInFlightExecution({
    workflowRunId,
    workspaceId,
  }: {
    workflowRunId: string;
    workspaceId: string;
  }): Promise<void> {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    const stepInfos = workflowRun.state?.stepInfos ?? {};
    const steps = workflowRun.state?.flow?.steps ?? [];

    const inFlightSteps = steps.filter(
      (step) => stepInfos[step.id]?.status === StepStatus.RUNNING,
    );

    if (inFlightSteps.length === 0) {
      return;
    }

    this.logger.warn(
      `Recovering ${inFlightSteps.length} in-flight step(s) of stalled workflow run ${workflowRunId}`,
    );

    // Iterators recompute their position themselves; other steps must go back
    // to NOT_STARTED or shouldExecuteStep refuses to run them again.
    const stepInfosToReset = inFlightSteps
      .filter((step) => !isWorkflowIteratorAction(step))
      .reduce<Record<string, WorkflowRunStepInfo>>((acc, step) => {
        const stepInfo = stepInfos[step.id];

        acc[step.id] = {
          ...stepInfo,
          status: StepStatus.NOT_STARTED,
          result: undefined,
          error: undefined,
          history: [
            ...(stepInfo?.history ?? []),
            {
              result: stepInfo?.result,
              error: stepInfo?.error,
              status: stepInfo?.status,
            },
          ],
        };

        return acc;
      }, {});

    if (Object.keys(stepInfosToReset).length > 0) {
      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfos({
        stepInfos: stepInfosToReset,
        workflowRunId,
        workspaceId,
      });
    }

    await this.workflowExecutorWorkspaceService.executeFromSteps({
      stepIds: inFlightSteps.map((step) => step.id),
      workflowRunId,
      workspaceId,
    });
  }

  private async retryWorkflowExecution({
    workflowRunId,
    stepIdsToRetry,
    workspaceId,
  }: {
    workflowRunId: string;
    stepIdsToRetry: string[];
    workspaceId: string;
  }): Promise<void> {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
      return;
    }

    await this.workflowExecutorWorkspaceService.executeFromSteps({
      stepIds: stepIdsToRetry,
      workflowRunId,
      workspaceId,
    });
  }

  private async resumeWorkflowExecution({
    workflowRunId,
    lastExecutedStepId,
    workspaceId,
  }: {
    workflowRunId: string;
    lastExecutedStepId: string;
    workspaceId: string;
  }): Promise<void> {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
      return;
    }

    const lastExecutedStep = workflowRun.state?.flow?.steps?.find(
      (step) => step.id === lastExecutedStepId,
    );

    if (!lastExecutedStep) {
      throw new WorkflowRunException(
        'Last executed step not found',
        WorkflowRunExceptionCode.INVALID_INPUT,
      );
    }

    const lastExecutedStepOutput =
      workflowRun.state?.stepInfos[lastExecutedStepId];

    const { nextStepIdsToExecute, nextStepIdsToSkip, nextStepIdsToFailSafely } =
      await this.workflowExecutorWorkspaceService.getNextStepIdsToExecute({
        executedStep: lastExecutedStep,
        executedStepOutput: lastExecutedStepOutput,
      });

    const hasStepsToSkipOrFailSafely =
      isDefined(nextStepIdsToSkip) || isDefined(nextStepIdsToFailSafely);

    const hasStepsToExecute =
      isDefined(nextStepIdsToExecute) && nextStepIdsToExecute.length > 0;

    if (!hasStepsToSkipOrFailSafely && !hasStepsToExecute) {
      await this.workflowRunWorkspaceService.endWorkflowRun({
        workflowRunId,
        workspaceId,
        status: WorkflowRunStatus.COMPLETED,
      });

      return;
    }

    const steps = workflowRun.state?.flow?.steps ?? [];

    if (hasStepsToSkipOrFailSafely) {
      await this.workflowExecutorWorkspaceService.skipAndFailSafelyStepsThenContinue(
        {
          stepIdsToSkip: nextStepIdsToSkip ?? [],
          stepIdsToFailSafely: nextStepIdsToFailSafely ?? [],
          steps,
          workflowRunId,
          workspaceId,
          executedStepsCount: 0,
        },
      );
    }

    if (hasStepsToExecute) {
      await this.workflowExecutorWorkspaceService.executeFromSteps({
        stepIds: nextStepIdsToExecute,
        workflowRunId,
        workspaceId,
      });
    }
  }

  private async incrementTriggerMetrics({
    workflowRunId,
    triggerType,
  }: {
    workflowRunId: string;
    triggerType: string;
  }) {
    let key: MetricsKeys;

    switch (triggerType) {
      case WorkflowTriggerType.DATABASE_EVENT:
        key = MetricsKeys.WorkflowRunStartedDatabaseEventTrigger;
        break;
      case WorkflowTriggerType.CRON:
        key = MetricsKeys.WorkflowRunStartedCronTrigger;
        break;
      case WorkflowTriggerType.WEBHOOK:
        key = MetricsKeys.WorkflowRunStartedWebhookTrigger;
        break;
      case WorkflowTriggerType.MANUAL:
        key = MetricsKeys.WorkflowRunStartedManualTrigger;
        break;
      default:
        throw new Error('Invalid trigger type');
    }

    await this.metricsService.incrementCounterForEvent({
      key,
      eventId: workflowRunId,
    });
  }
}
