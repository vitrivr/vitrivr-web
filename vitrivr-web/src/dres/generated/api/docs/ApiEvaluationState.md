# ApiEvaluationState


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**evaluationId** | **string** |  | [default to undefined]
**evaluationStatus** | [**ApiEvaluationStatus**](ApiEvaluationStatus.md) |  | [default to undefined]
**taskId** | **string** |  | [optional] [default to undefined]
**taskStatus** | [**ApiTaskStatus**](ApiTaskStatus.md) |  | [default to undefined]
**taskTemplateId** | **string** |  | [optional] [default to undefined]
**timeLeft** | **number** |  | [default to undefined]
**timeElapsed** | **number** |  | [default to undefined]

## Example

```typescript
import { ApiEvaluationState } from './api';

const instance: ApiEvaluationState = {
    evaluationId,
    evaluationStatus,
    taskId,
    taskStatus,
    taskTemplateId,
    timeLeft,
    timeElapsed,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
