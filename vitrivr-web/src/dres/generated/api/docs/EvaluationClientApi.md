# EvaluationClientApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getApiV2ClientEvaluationCurrentTaskByEvaluationId**](#getapiv2clientevaluationcurrenttaskbyevaluationid) | **GET** /api/v2/client/evaluation/currentTask/{evaluationId} | Returns an overview of the currently active task for a run.|
|[**getApiV2ClientEvaluationList**](#getapiv2clientevaluationlist) | **GET** /api/v2/client/evaluation/list | Lists an overview of all evaluation runs visible to the current client.|

# **getApiV2ClientEvaluationCurrentTaskByEvaluationId**
> ApiClientTaskTemplateInfo getApiV2ClientEvaluationCurrentTaskByEvaluationId()


### Example

```typescript
import {
    EvaluationClientApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EvaluationClientApi(configuration);

let evaluationId: string; //The evaluation ID. (default to undefined)
let session: string; //Session Token (optional) (default to undefined)

const { status, data } = await apiInstance.getApiV2ClientEvaluationCurrentTaskByEvaluationId(
    evaluationId,
    session
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **evaluationId** | [**string**] | The evaluation ID. | defaults to undefined|
| **session** | [**string**] | Session Token | (optional) defaults to undefined|


### Return type

**ApiClientTaskTemplateInfo**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2ClientEvaluationList**
> Array<ApiClientEvaluationInfo> getApiV2ClientEvaluationList()


### Example

```typescript
import {
    EvaluationClientApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EvaluationClientApi(configuration);

let session: string; //Session Token (optional) (default to undefined)

const { status, data } = await apiInstance.getApiV2ClientEvaluationList(
    session
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **session** | [**string**] | Session Token | (optional) defaults to undefined|


### Return type

**Array<ApiClientEvaluationInfo>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

