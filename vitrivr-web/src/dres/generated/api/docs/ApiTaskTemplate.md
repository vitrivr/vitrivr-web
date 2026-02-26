# ApiTaskTemplate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [optional] [default to undefined]
**name** | **string** |  | [default to undefined]
**taskGroup** | **string** |  | [default to undefined]
**taskType** | **string** |  | [default to undefined]
**duration** | **number** |  | [default to undefined]
**collectionId** | **string** |  | [default to undefined]
**targets** | [**Array&lt;ApiTarget&gt;**](ApiTarget.md) |  | [default to undefined]
**hints** | [**Array&lt;ApiHint&gt;**](ApiHint.md) |  | [default to undefined]
**comment** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { ApiTaskTemplate } from './api';

const instance: ApiTaskTemplate = {
    id,
    name,
    taskGroup,
    taskType,
    duration,
    collectionId,
    targets,
    hints,
    comment,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
