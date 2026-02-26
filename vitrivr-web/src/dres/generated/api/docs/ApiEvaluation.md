# ApiEvaluation


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**evaluationId** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**type** | [**ApiEvaluationType**](ApiEvaluationType.md) |  | [default to undefined]
**template** | [**ApiEvaluationTemplate**](ApiEvaluationTemplate.md) |  | [default to undefined]
**created** | **number** |  | [default to undefined]
**started** | **number** |  | [optional] [default to undefined]
**ended** | **number** |  | [optional] [default to undefined]
**tasks** | [**Array&lt;ApiTask&gt;**](ApiTask.md) |  | [default to undefined]

## Example

```typescript
import { ApiEvaluation } from './api';

const instance: ApiEvaluation = {
    evaluationId,
    name,
    type,
    template,
    created,
    started,
    ended,
    tasks,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
