# ApiTaskType


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** |  | [default to undefined]
**duration** | **number** |  | [default to undefined]
**targetOption** | [**ApiTargetOption**](ApiTargetOption.md) |  | [default to undefined]
**hintOptions** | [**Array&lt;ApiHintOption&gt;**](ApiHintOption.md) |  | [default to undefined]
**submissionOptions** | [**Array&lt;ApiSubmissionOption&gt;**](ApiSubmissionOption.md) |  | [default to undefined]
**taskOptions** | [**Array&lt;ApiTaskOption&gt;**](ApiTaskOption.md) |  | [default to undefined]
**scoreOption** | [**ApiScoreOption**](ApiScoreOption.md) |  | [default to undefined]
**configuration** | **{ [key: string]: string; }** |  | [default to undefined]

## Example

```typescript
import { ApiTaskType } from './api';

const instance: ApiTaskType = {
    name,
    duration,
    targetOption,
    hintOptions,
    submissionOptions,
    taskOptions,
    scoreOption,
    configuration,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
