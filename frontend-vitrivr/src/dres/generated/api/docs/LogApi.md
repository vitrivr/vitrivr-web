# LogApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**postApiV2LogQueryByEvaluationId**](#postapiv2logquerybyevaluationid) | **POST** /api/v2/log/query/{evaluationId} | Accepts query logs from participants for the specified evaluation.|
|[**postApiV2LogResultByEvaluationId**](#postapiv2logresultbyevaluationid) | **POST** /api/v2/log/result/{evaluationId} | Accepts result logs from participants  for the specified evaluation.|

# **postApiV2LogQueryByEvaluationId**
> SuccessStatus postApiV2LogQueryByEvaluationId()


### Example

```typescript
import {
    LogApi,
    Configuration,
    QueryEventLog
} from './api';

const configuration = new Configuration();
const apiInstance = new LogApi(configuration);

let evaluationId: string; //The evaluation ID. (default to undefined)
let session: string; //Session Token (default to undefined)
let queryEventLog: QueryEventLog; // (optional)

const { status, data } = await apiInstance.postApiV2LogQueryByEvaluationId(
    evaluationId,
    session,
    queryEventLog
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **queryEventLog** | **QueryEventLog**|  | |
| **evaluationId** | [**string**] | The evaluation ID. | defaults to undefined|
| **session** | [**string**] | Session Token | defaults to undefined|


### Return type

**SuccessStatus**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postApiV2LogResultByEvaluationId**
> SuccessStatus postApiV2LogResultByEvaluationId()


### Example

```typescript
import {
    LogApi,
    Configuration,
    QueryResultLog
} from './api';

const configuration = new Configuration();
const apiInstance = new LogApi(configuration);

let evaluationId: string; //The evaluation ID. (default to undefined)
let session: string; //Session Token (default to undefined)
let queryResultLog: QueryResultLog; // (optional)

const { status, data } = await apiInstance.postApiV2LogResultByEvaluationId(
    evaluationId,
    session,
    queryResultLog
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **queryResultLog** | **QueryResultLog**|  | |
| **evaluationId** | [**string**] | The evaluation ID. | defaults to undefined|
| **session** | [**string**] | Session Token | defaults to undefined|


### Return type

**SuccessStatus**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

