# ApiEvaluationTemplate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**description** | **string** |  | [optional] [default to undefined]
**created** | **number** |  | [optional] [default to undefined]
**modified** | **number** |  | [optional] [default to undefined]
**taskTypes** | [**Array&lt;ApiTaskType&gt;**](ApiTaskType.md) |  | [default to undefined]
**taskGroups** | [**Array&lt;ApiTaskGroup&gt;**](ApiTaskGroup.md) |  | [default to undefined]
**tasks** | [**Array&lt;ApiTaskTemplate&gt;**](ApiTaskTemplate.md) |  | [default to undefined]
**teams** | [**Array&lt;ApiTeam&gt;**](ApiTeam.md) |  | [default to undefined]
**teamGroups** | [**Array&lt;ApiTeamGroup&gt;**](ApiTeamGroup.md) |  | [default to undefined]
**judges** | **Array&lt;string&gt;** |  | [default to undefined]
**viewers** | **Array&lt;string&gt;** |  | [default to undefined]

## Example

```typescript
import { ApiEvaluationTemplate } from './api';

const instance: ApiEvaluationTemplate = {
    id,
    name,
    description,
    created,
    modified,
    taskTypes,
    taskGroups,
    tasks,
    teams,
    teamGroups,
    judges,
    viewers,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
