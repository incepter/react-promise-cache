import axios from "axios";
import {patchQuery} from "react-promise-cache";

export const API = axios.create({
  baseURL: "https://jsonplaceholder.typicode.com",
});

let patchedGet = patchQuery(API.get, url => url)
API.get = patchedGet;
