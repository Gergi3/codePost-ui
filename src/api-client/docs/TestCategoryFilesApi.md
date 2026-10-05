# TestCategoryFilesApi

All URIs are relative to *http://localhost*

| Method                                                     | HTTP request                        | Description |
| ---------------------------------------------------------- | ----------------------------------- | ----------- |
| [**create**](TestCategoryFilesApi.md#create)               | **POST** /testCategoryFiles/        |             |
| [**destroy**](TestCategoryFilesApi.md#destroy)             | **DELETE** /testCategoryFiles/{id}/ |             |
| [**list**](TestCategoryFilesApi.md#list)                   | **GET** /testCategoryFiles/         |             |
| [**partialUpdate**](TestCategoryFilesApi.md#partialupdate) | **PATCH** /testCategoryFiles/{id}/  |             |
| [**retrieve**](TestCategoryFilesApi.md#retrieve)           | **GET** /testCategoryFiles/{id}/    |             |
| [**update**](TestCategoryFilesApi.md#update)               | **PUT** /testCategoryFiles/{id}/    |             |

## create

> TestCategoryFile create(testCategoryFile)

list: Return a list of all the testCategoryFiles. create: Create a new testCategoryFile. retrieve: Return the given testCategoryFile. update: Update a testCategoryFile. partial_update: Update a testCategoryFile. delete: Delete a testCategoryFile.

### Example

```ts
import {
  Configuration,
  TestCategoryFilesApi,
} from '';
import type { CreateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: tokenAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: courseKeyAuth
    apiKey: "YOUR API KEY",
  });
  const api = new TestCategoryFilesApi(config);

  const body = {
    // TestCategoryFile
    testCategoryFile: ...,
  } satisfies CreateRequest;

  try {
    const data = await api.create(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                 | Type                                    | Description | Notes |
| -------------------- | --------------------------------------- | ----------- | ----- |
| **testCategoryFile** | [TestCategoryFile](TestCategoryFile.md) |             |       |

### Return type

[**TestCategoryFile**](TestCategoryFile.md)

### Authorization

[basicAuth](../README.md#basicAuth), [tokenAuth](../README.md#tokenAuth), [cookieAuth](../README.md#cookieAuth), [courseKeyAuth](../README.md#courseKeyAuth)

### HTTP request headers

- **Content-Type**: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **201**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## destroy

> destroy(id)

list: Return a list of all the testCategoryFiles. create: Create a new testCategoryFile. retrieve: Return the given testCategoryFile. update: Update a testCategoryFile. partial_update: Update a testCategoryFile. delete: Delete a testCategoryFile.

### Example

```ts
import { Configuration, TestCategoryFilesApi } from '';
import type { DestroyRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: 'YOUR USERNAME',
    password: 'YOUR PASSWORD',
    // To configure API key authorization: tokenAuth
    apiKey: 'YOUR API KEY',
    // To configure API key authorization: cookieAuth
    apiKey: 'YOUR API KEY',
    // To configure API key authorization: courseKeyAuth
    apiKey: 'YOUR API KEY',
  });
  const api = new TestCategoryFilesApi(config);

  const body = {
    // number | A unique integer value identifying this test category file.
    id: 56,
  } satisfies DestroyRequest;

  try {
    const data = await api.destroy(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name   | Type     | Description                                                 | Notes                     |
| ------ | -------- | ----------------------------------------------------------- | ------------------------- |
| **id** | `number` | A unique integer value identifying this test category file. | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[basicAuth](../README.md#basicAuth), [tokenAuth](../README.md#tokenAuth), [cookieAuth](../README.md#cookieAuth), [courseKeyAuth](../README.md#courseKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **204**     | No response body | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## list

> Array&lt;TestCategoryFile&gt; list()

list: Return a list of all the testCategoryFiles. create: Create a new testCategoryFile. retrieve: Return the given testCategoryFile. update: Update a testCategoryFile. partial_update: Update a testCategoryFile. delete: Delete a testCategoryFile.

### Example

```ts
import { Configuration, TestCategoryFilesApi } from '';
import type { ListRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: 'YOUR USERNAME',
    password: 'YOUR PASSWORD',
    // To configure API key authorization: tokenAuth
    apiKey: 'YOUR API KEY',
    // To configure API key authorization: cookieAuth
    apiKey: 'YOUR API KEY',
    // To configure API key authorization: courseKeyAuth
    apiKey: 'YOUR API KEY',
  });
  const api = new TestCategoryFilesApi(config);

  try {
    const data = await api.list();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;TestCategoryFile&gt;**](TestCategoryFile.md)

### Authorization

[basicAuth](../README.md#basicAuth), [tokenAuth](../README.md#tokenAuth), [cookieAuth](../README.md#cookieAuth), [courseKeyAuth](../README.md#courseKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## partialUpdate

> TestCategoryFile partialUpdate(id, patchedTestCategoryFile)

list: Return a list of all the testCategoryFiles. create: Create a new testCategoryFile. retrieve: Return the given testCategoryFile. update: Update a testCategoryFile. partial_update: Update a testCategoryFile. delete: Delete a testCategoryFile.

### Example

```ts
import {
  Configuration,
  TestCategoryFilesApi,
} from '';
import type { PartialUpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: tokenAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: courseKeyAuth
    apiKey: "YOUR API KEY",
  });
  const api = new TestCategoryFilesApi(config);

  const body = {
    // number | A unique integer value identifying this test category file.
    id: 56,
    // PatchedTestCategoryFile (optional)
    patchedTestCategoryFile: ...,
  } satisfies PartialUpdateRequest;

  try {
    const data = await api.partialUpdate(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                        | Type                                                  | Description                                                 | Notes                     |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| **id**                      | `number`                                              | A unique integer value identifying this test category file. | [Defaults to `undefined`] |
| **patchedTestCategoryFile** | [PatchedTestCategoryFile](PatchedTestCategoryFile.md) |                                                             | [Optional]                |

### Return type

[**TestCategoryFile**](TestCategoryFile.md)

### Authorization

[basicAuth](../README.md#basicAuth), [tokenAuth](../README.md#tokenAuth), [cookieAuth](../README.md#cookieAuth), [courseKeyAuth](../README.md#courseKeyAuth)

### HTTP request headers

- **Content-Type**: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## retrieve

> TestCategoryFile retrieve(id)

list: Return a list of all the testCategoryFiles. create: Create a new testCategoryFile. retrieve: Return the given testCategoryFile. update: Update a testCategoryFile. partial_update: Update a testCategoryFile. delete: Delete a testCategoryFile.

### Example

```ts
import { Configuration, TestCategoryFilesApi } from '';
import type { RetrieveRequest } from '';

async function example() {
  console.log('🚀 Testing  SDK...');
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: 'YOUR USERNAME',
    password: 'YOUR PASSWORD',
    // To configure API key authorization: tokenAuth
    apiKey: 'YOUR API KEY',
    // To configure API key authorization: cookieAuth
    apiKey: 'YOUR API KEY',
    // To configure API key authorization: courseKeyAuth
    apiKey: 'YOUR API KEY',
  });
  const api = new TestCategoryFilesApi(config);

  const body = {
    // number | A unique integer value identifying this test category file.
    id: 56,
  } satisfies RetrieveRequest;

  try {
    const data = await api.retrieve(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name   | Type     | Description                                                 | Notes                     |
| ------ | -------- | ----------------------------------------------------------- | ------------------------- |
| **id** | `number` | A unique integer value identifying this test category file. | [Defaults to `undefined`] |

### Return type

[**TestCategoryFile**](TestCategoryFile.md)

### Authorization

[basicAuth](../README.md#basicAuth), [tokenAuth](../README.md#tokenAuth), [cookieAuth](../README.md#cookieAuth), [courseKeyAuth](../README.md#courseKeyAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## update

> TestCategoryFile update(id, testCategoryFile)

list: Return a list of all the testCategoryFiles. create: Create a new testCategoryFile. retrieve: Return the given testCategoryFile. update: Update a testCategoryFile. partial_update: Update a testCategoryFile. delete: Delete a testCategoryFile.

### Example

```ts
import {
  Configuration,
  TestCategoryFilesApi,
} from '';
import type { UpdateRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // To configure HTTP basic authorization: basicAuth
    username: "YOUR USERNAME",
    password: "YOUR PASSWORD",
    // To configure API key authorization: tokenAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: cookieAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: courseKeyAuth
    apiKey: "YOUR API KEY",
  });
  const api = new TestCategoryFilesApi(config);

  const body = {
    // number | A unique integer value identifying this test category file.
    id: 56,
    // TestCategoryFile
    testCategoryFile: ...,
  } satisfies UpdateRequest;

  try {
    const data = await api.update(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                 | Type                                    | Description                                                 | Notes                     |
| -------------------- | --------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| **id**               | `number`                                | A unique integer value identifying this test category file. | [Defaults to `undefined`] |
| **testCategoryFile** | [TestCategoryFile](TestCategoryFile.md) |                                                             |                           |

### Return type

[**TestCategoryFile**](TestCategoryFile.md)

### Authorization

[basicAuth](../README.md#basicAuth), [tokenAuth](../README.md#tokenAuth), [cookieAuth](../README.md#cookieAuth), [courseKeyAuth](../README.md#courseKeyAuth)

### HTTP request headers

- **Content-Type**: `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
