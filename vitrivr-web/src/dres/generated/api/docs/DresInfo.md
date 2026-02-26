# DresInfo


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**version** | **string** |  | [default to undefined]
**startTime** | **number** |  | [default to undefined]
**uptime** | **number** |  | [default to undefined]
**os** | **string** |  | [optional] [default to undefined]
**jvm** | **string** |  | [optional] [default to undefined]
**args** | **string** |  | [optional] [default to undefined]
**cores** | **number** |  | [optional] [default to undefined]
**freeMemory** | **number** |  | [optional] [default to undefined]
**totalMemory** | **number** |  | [optional] [default to undefined]
**load** | **number** |  | [optional] [default to undefined]
**availableSeverThreads** | **number** |  | [optional] [default to undefined]

## Example

```typescript
import { DresInfo } from './api';

const instance: DresInfo = {
    version,
    startTime,
    uptime,
    os,
    jvm,
    args,
    cores,
    freeMemory,
    totalMemory,
    load,
    availableSeverThreads,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
