# UserApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteApiV2UserByUserId**](#deleteapiv2userbyuserid) | **DELETE** /api/v2/user/{userId} | Deletes the specified user. Requires ADMIN privileges|
|[**getApiV2Logout**](#getapiv2logout) | **GET** /api/v2/logout | Clears all user roles of the current session.|
|[**getApiV2User**](#getapiv2user) | **GET** /api/v2/user | Get information about the current user.|
|[**getApiV2UserByUserId**](#getapiv2userbyuserid) | **GET** /api/v2/user/{userId} | Gets details of the user with the given id.|
|[**getApiV2UserSession**](#getapiv2usersession) | **GET** /api/v2/user/session | Get current sessionId|
|[**patchApiV2UserByUserId**](#patchapiv2userbyuserid) | **PATCH** /api/v2/user/{userId} | Updates the specified user, if it exists. Anyone is allowed to update their data, however only ADMINs are allowed to update anyone.|
|[**postApiV2Login**](#postapiv2login) | **POST** /api/v2/login | Sets roles for session based on user account and returns a session cookie.|
|[**postApiV2User**](#postapiv2user) | **POST** /api/v2/user | Creates a new user, if the username is not already taken. Requires ADMIN privileges|

# **deleteApiV2UserByUserId**
> ApiUser deleteApiV2UserByUserId()


### Example

```typescript
import {
    UserApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let userId: string; //User ID (default to undefined)

const { status, data } = await apiInstance.deleteApiV2UserByUserId(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] | User ID | defaults to undefined|


### Return type

**ApiUser**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | If the user could not be found |  -  |
|**500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2Logout**
> SuccessStatus getApiV2Logout()


### Example

```typescript
import {
    UserApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let session: string; //Session Token (optional) (default to undefined)

const { status, data } = await apiInstance.getApiV2Logout(
    session
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **session** | [**string**] | Session Token | (optional) defaults to undefined|


### Return type

**SuccessStatus**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2User**
> ApiUser getApiV2User()


### Example

```typescript
import {
    UserApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

const { status, data } = await apiInstance.getApiV2User();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiUser**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2UserByUserId**
> ApiUser getApiV2UserByUserId()


### Example

```typescript
import {
    UserApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let userId: string; //User\'s UID (default to undefined)

const { status, data } = await apiInstance.getApiV2UserByUserId(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] | User\&#39;s UID | defaults to undefined|


### Return type

**ApiUser**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | If the user could not be found. |  -  |
|**500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getApiV2UserSession**
> string getApiV2UserSession()


### Example

```typescript
import {
    UserApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let session: string; //Session Token (optional) (default to undefined)

const { status, data } = await apiInstance.getApiV2UserSession(
    session
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **session** | [**string**] | Session Token | (optional) defaults to undefined|


### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/plain, application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **patchApiV2UserByUserId**
> ApiUser patchApiV2UserByUserId()


### Example

```typescript
import {
    UserApi,
    Configuration,
    ApiUserRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let userId: string; //User ID (default to undefined)
let apiUserRequest: ApiUserRequest; // (optional)

const { status, data } = await apiInstance.patchApiV2UserByUserId(
    userId,
    apiUserRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **apiUserRequest** | **ApiUserRequest**|  | |
| **userId** | [**string**] | User ID | defaults to undefined|


### Return type

**ApiUser**

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
|**404** | Not Found |  -  |
|**500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **postApiV2Login**
> ApiUser postApiV2Login()


### Example

```typescript
import {
    UserApi,
    Configuration,
    LoginRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let loginRequest: LoginRequest; // (optional)

const { status, data } = await apiInstance.postApiV2Login(
    loginRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **loginRequest** | **LoginRequest**|  | |


### Return type

**ApiUser**

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

# **postApiV2User**
> ApiUser postApiV2User()


### Example

```typescript
import {
    UserApi,
    Configuration,
    ApiUserRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new UserApi(configuration);

let apiUserRequest: ApiUserRequest; // (optional)

const { status, data } = await apiInstance.postApiV2User(
    apiUserRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **apiUserRequest** | **ApiUserRequest**|  | |


### Return type

**ApiUser**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | If the username is already taken |  -  |
|**500** | Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

