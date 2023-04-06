import axios from "axios";
import {patchQuery, patchMutation} from "react-promise-cache";

export const API = axios.create({
  baseURL: "https://jsonplaceholder.typicode.com",
});

// for some reason, direct assignment throws a ts error, to be fixed
let patchedGet = patchQuery(API.get, (url) => url)
let patchedPut = patchMutation(API.put, url => url)
let patchedPost = patchMutation(API.post, url => url)
let patchedPatch = patchMutation(API.patch, url => url)
let patchedDelete = patchMutation(API.delete, url => url)

API.get = patchedGet
API.put = patchedPut
API.post = patchedPost
API.patch = patchedPatch
API.delete = patchedDelete
