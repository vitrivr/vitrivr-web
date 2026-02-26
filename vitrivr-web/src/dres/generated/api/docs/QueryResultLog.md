# QueryResultLog


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**timestamp** | **number** |  | [default to undefined]
**sortType** | **string** |  | [default to undefined]
**resultSetAvailability** | **string** |  | [default to undefined]
**results** | [**Array&lt;RankedAnswer&gt;**](RankedAnswer.md) |  | [default to undefined]
**events** | [**Array&lt;QueryEvent&gt;**](QueryEvent.md) |  | [default to undefined]

## Example

```typescript
import { QueryResultLog } from './api';

const instance: QueryResultLog = {
    timestamp,
    sortType,
    resultSetAvailability,
    results,
    events,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
