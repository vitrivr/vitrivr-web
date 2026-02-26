# ApiClientEvaluationInfo


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**type** | [**ApiEvaluationType**](ApiEvaluationType.md) |  | [default to undefined]
**status** | [**ApiEvaluationStatus**](ApiEvaluationStatus.md) |  | [default to undefined]
**templateId** | **string** |  | [default to undefined]
**templateDescription** | **string** |  | [optional] [default to undefined]
**teams** | **Array&lt;string&gt;** |  | [default to undefined]
**taskTemplates** | [**Array&lt;ApiClientTaskTemplateInfo&gt;**](ApiClientTaskTemplateInfo.md) |  | [default to undefined]

## Example

```typescript
import { ApiClientEvaluationInfo } from './api';

const instance: ApiClientEvaluationInfo = {
    id,
    name,
    type,
    status,
    templateId,
    templateDescription,
    teams,
    taskTemplates,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
