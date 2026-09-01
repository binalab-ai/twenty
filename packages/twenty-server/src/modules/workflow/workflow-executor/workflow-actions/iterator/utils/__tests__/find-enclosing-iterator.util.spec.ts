import {
  createMockCodeStep,
  createMockIteratorStep,
} from 'src/modules/workflow/workflow-executor/utils/create-mock-workflow-steps.util';
import { findEnclosingIterator } from 'src/modules/workflow/workflow-executor/workflow-actions/iterator/utils/find-enclosing-iterator.util';

describe('findEnclosingIterator', () => {
  it('should return undefined when step is not inside any iterator', () => {
    const steps = [
      createMockCodeStep('step1', ['step2']),
      createMockCodeStep('step2', []),
    ];

    const result = findEnclosingIterator({
      stepId: 'step1',
      steps,
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined for the iterator step itself', () => {
    const steps = [
      createMockIteratorStep('iterator1', ['after'], ['stepA'], false),
      createMockCodeStep('stepA', ['iterator1']),
      createMockCodeStep('after', []),
    ];

    const result = findEnclosingIterator({
      stepId: 'iterator1',
      steps,
    });

    expect(result).toBeUndefined();
  });

  it('should return the enclosing iterator regardless of the continue-on-failure flag', () => {
    const steps = [
      createMockIteratorStep('iterator1', ['after'], ['stepA'], false),
      createMockCodeStep('stepA', ['stepB']),
      createMockCodeStep('stepB', ['iterator1']),
      createMockCodeStep('after', []),
    ];

    const result = findEnclosingIterator({
      stepId: 'stepA',
      steps,
    });

    expect(result?.id).toBe('iterator1');
  });

  it('should find the iterator of a loop-body leaf missing its loop-back edge', () => {
    const steps = [
      createMockIteratorStep('iterator1', ['after'], ['stepA'], false),
      createMockCodeStep('stepA', []),
      createMockCodeStep('after', []),
    ];

    const result = findEnclosingIterator({
      stepId: 'stepA',
      steps,
    });

    expect(result?.id).toBe('iterator1');
  });

  it('should return the innermost iterator in nested iterators', () => {
    const steps = [
      createMockIteratorStep('outerIterator', ['after'], ['innerIterator'], false),
      createMockIteratorStep('innerIterator', ['outerIterator'], ['stepA'], false),
      createMockCodeStep('stepA', ['innerIterator']),
      createMockCodeStep('after', []),
    ];

    const result = findEnclosingIterator({
      stepId: 'stepA',
      steps,
    });

    expect(result?.id).toBe('innerIterator');
  });
});
