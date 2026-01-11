# SubmissionApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**postApiV2SubmitByEvaluationId**](#postapiv2submitbyevaluationid) | **POST** /api/v2/submit/{evaluationId} | Endpoint to accept submissions.|

# **postApiV2SubmitByEvaluationId**
> SuccessfulSubmissionsStatus postApiV2SubmitByEvaluationId(apiClientSubmission)


### Example

```typescript
import {
    SubmissionApi,
    Configuration,
    ApiClientSubmission
} from './api';

const configuration = new Configuration();
const apiInstance = new SubmissionApi(configuration);

let evaluationId: string; //The ID of the evaluation the submission belongs to. (default to undefined)
let apiClientSubmission: ApiClientSubmission; //Some notes regarding the submission format. At least one answerSet is required, taskId, taskName are inferred if not provided,  at least one answer is required, mediaItemCollectionName is inferred if not provided,  start and end should be provided in milliseconds.For most evaluation setups, an answer is built in one of the three following ways: A) only text is required: just provide the text property with a meaningful entry B) only a mediaItemName is required: just provide the mediaItemName, optionally with the collection name. C) a specific portion of a mediaItem is required: provide mediaItemName, start and end, optionally with collection name
let session: string; //Session Token (optional) (default to undefined)

const { status, data } = await apiInstance.postApiV2SubmitByEvaluationId(
    evaluationId,
    apiClientSubmission,
    session
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **apiClientSubmission** | **ApiClientSubmission**| Some notes regarding the submission format. At least one answerSet is required, taskId, taskName are inferred if not provided,  at least one answer is required, mediaItemCollectionName is inferred if not provided,  start and end should be provided in milliseconds.For most evaluation setups, an answer is built in one of the three following ways: A) only text is required: just provide the text property with a meaningful entry B) only a mediaItemName is required: just provide the mediaItemName, optionally with the collection name. C) a specific portion of a mediaItem is required: provide mediaItemName, start and end, optionally with collection name | |
| **evaluationId** | [**string**] | The ID of the evaluation the submission belongs to. | defaults to undefined|
| **session** | [**string**] | Session Token | (optional) defaults to undefined|


### Return type

**SuccessfulSubmissionsStatus**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | The submission was accepted by the server and there was a verdict |  -  |
|**202** | The submission was accepted by the server and there has not yet been a verdict available |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |
|**412** | The submission was rejected by the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

