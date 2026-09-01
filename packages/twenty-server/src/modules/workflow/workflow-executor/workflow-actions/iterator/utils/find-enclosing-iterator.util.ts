import { isWorkflowIteratorAction } from 'src/modules/workflow/workflow-executor/workflow-actions/iterator/guards/is-workflow-iterator-action.guard';
import { getAllStepIdsInLoop } from 'src/modules/workflow/workflow-executor/workflow-actions/iterator/utils/get-all-step-ids-in-loop.util';
import {
  type WorkflowAction,
  type WorkflowIteratorAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

// Innermost iterator whose loop body contains the given step. The canvas
// draws the loop from initialLoopStepIds alone, so a graph can look correct
// while the body's last step is missing its explicit edge back to the
// iterator - this lookup is what lets the executor route such a dead-ending
// step back to the loop.
export const findEnclosingIterator = ({
  stepId,
  steps,
}: {
  stepId: string;
  steps: WorkflowAction[];
}): WorkflowIteratorAction | undefined => {
  const iteratorSteps = steps.filter(isWorkflowIteratorAction);

  const candidates = iteratorSteps
    .filter(
      (iterator) =>
        iterator.settings.input.initialLoopStepIds &&
        iterator.settings.input.initialLoopStepIds.length > 0,
    )
    .map((iterator) => ({
      iterator,
      loopStepIds: getAllStepIdsInLoop({
        iteratorStepId: iterator.id,
        initialLoopStepIds: iterator.settings.input.initialLoopStepIds!,
        steps,
      }),
    }))
    .filter(({ loopStepIds }) => loopStepIds.includes(stepId))
    .sort((a, b) => a.loopStepIds.length - b.loopStepIds.length);

  return candidates[0]?.iterator;
};
