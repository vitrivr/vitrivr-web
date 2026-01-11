# EvaluationApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getApiV2EvaluationByEvaluationIdInfo**](#getapiv2evaluationbyevaluationidinfo) | **GET** /api/v2/evaluation/{evaluationId}/info | Returns basic information about a specific evaluation.|
|[**getApiV2EvaluationByEvaluationIdState**](#getapiv2evaluationbyevaluationidstate) | **GET** /api/v2/evaluation/{evaluationId}/state | Returns the state of a specific evaluation.|
|[**getApiV2EvaluationInfoList**](#getapiv2evaluationinfolist) | **GET** /api/v2/evaluation/info/list | Lists an overview of all evaluations visible to the current user.|
|[**getApiV2EvaluationStateList**](#getapiv2evaluationstatelist) | **GET** /api/v2/evaluation/state/list | Lists an overview of all evaluation visible to the current user.|

# **getApiV2EvaluationByEvaluationIdInfo**
> ApiEvaluationInfo getApiV2EvaluationByEvaluationIdInfo()


### Example

```typescript
import {
    EvaluationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EvaluationApi(configuration);

let evaluationId: string; //The evaluation ID. (default to undefined)

const { status, data } = await apiInstance.getApiV2EvaluationByEvaluationIdInfo(
    evaluationId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **evaluationId** | [**string**] | The evaluation ID. | defaults to undefined|


### Return type

**ApiEvaluationInfo**

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
|**403** | Forbidden |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2EvaluationByEvaluationIdState**
> ApiEvaluationState getApiV2EvaluationByEvaluationIdState()


### Example

```typescript
import {
    EvaluationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EvaluationApi(configuration);

let evaluationId: string; //The evaluation ID. (default to undefined)

const { status, data } = await apiInstance.getApiV2EvaluationByEvaluationIdState(
    evaluationId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **evaluationId** | [**string**] | The evaluation ID. | defaults to undefined|


### Return type

**ApiEvaluationState**

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
|**403** | Forbidden |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2EvaluationInfoList**
> Array<ApiEvaluationInfo> getApiV2EvaluationInfoList()


### Example

```typescript
import {
    EvaluationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EvaluationApi(configuration);

const { status, data } = await apiInstance.getApiV2EvaluationInfoList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<ApiEvaluationInfo>**

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

# **getApiV2EvaluationStateList**
> Array<ApiEvaluationState> getApiV2EvaluationStateList()


### Example

```typescript
import {
    EvaluationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new EvaluationApi(configuration);

const { status, data } = await apiInstance.getApiV2EvaluationStateList();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<ApiEvaluationState>**

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

