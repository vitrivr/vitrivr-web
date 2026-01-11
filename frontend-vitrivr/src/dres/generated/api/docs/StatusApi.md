# StatusApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getApiV2StatusTime**](#getapiv2statustime) | **GET** /api/v2/status/time | Returns the current time on the server.|

# **getApiV2StatusTime**
> CurrentTime getApiV2StatusTime()


### Example

```typescript
import {
    StatusApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new StatusApi(configuration);

const { status, data } = await apiInstance.getApiV2StatusTime();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**CurrentTime**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

