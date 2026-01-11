# ApiMediaItem


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**mediaItemId** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**type** | [**ApiMediaType**](ApiMediaType.md) |  | [default to undefined]
**collectionId** | **string** |  | [default to undefined]
**location** | **string** |  | [default to undefined]
**durationMs** | **number** |  | [optional] [default to undefined]
**fps** | **number** |  | [optional] [default to undefined]
**metadata** | [**Array&lt;ApiMediaItemMetaDataEntry&gt;**](ApiMediaItemMetaDataEntry.md) |  | [default to undefined]

## Example

```typescript
import { ApiMediaItem } from './api';

const instance: ApiMediaItem = {
    mediaItemId,
    name,
    type,
    collectionId,
    location,
    durationMs,
    fps,
    metadata,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
