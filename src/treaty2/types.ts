/// <reference lib="dom" />
import type { Elysia } from 'elysia'
import { EdenWS } from './ws'
import type { IsNever, Prettify } from '../types'

type Files = File | FileList

// type Replace<RecordType, TargetType, GenericType> = {
//     [K in keyof RecordType]: RecordType[K] extends TargetType
//         ? GenericType
//         : RecordType[K]
// }

type ReplaceBlobWithFiles<in out RecordType extends Record<string, unknown>> = {
    [K in keyof RecordType]: RecordType[K] extends Blob | Blob[]
        ? Files
        : RecordType[K]
} & {}

type ReplaceGeneratorWithAsyncGenerator<
    in out RecordType extends Record<string, unknown>
> = {
    [K in keyof RecordType]: RecordType[K] extends Generator<
        infer A,
        infer B,
        infer C
    >
        ? AsyncGenerator<A, B, C>
        : RecordType[K]
} & {}

type MaybeArray<T> = T | T[]
type MaybePromise<T> = T | Promise<T>

export namespace Treaty {
    interface TreatyParam {
        fetch?: RequestInit
    }

    export type Create<
        App extends Elysia<any, any, any, any, any, any, any, any>
    > = App extends {
        _routes: infer Schema extends Record<string, any>
    }
        ? Prettify<Sign<Schema>>
        : 'Please install Elysia before using Eden'

    export type Sign<in out Route extends Record<string, any>> = {
        [K in keyof Route as K extends `:${string}`
            ? never
            : K]: K extends 'subscribe' // ? Websocket route
            ? (undefined extends Route['subscribe']['headers']
                  ? { headers?: Record<string, unknown> }
                  : {
                        headers: Route['subscribe']['headers']
                    }) &
                  (undefined extends Route['subscribe']['query']
                      ? { query?: Record<string, unknown> }
                      : {
                            query: Route['subscribe']['query']
                        }) extends infer Param
                ? {} extends Param
                    ? (options?: Param) => EdenWS<Route['subscribe']>
                    : (options?: Param) => EdenWS<Route['subscribe']>
                : never
            : Route[K] extends {
                  body: infer Body
                  headers: infer Headers
                  params: any
                  query: infer Query
                  response: infer Response extends Record<number, unknown>
              }
            ? (undefined extends Headers
                  ? { headers?: Record<string, unknown> }
                  : {
                        headers: Headers
                    }) &
                  (undefined extends Query
                      ? { query?: Record<string, unknown> }
                      : { query: Query }) extends infer Param
                ? {} extends Param
                    ? undefined extends Body
                        ? K extends 'get' | 'head'
                            ? (
                                  options?: Prettify<Param & TreatyParam>
                              ) => Promise<TreatyResponse<Response>>
                            : (
                                  body?: Body,
                                  options?: Prettify<Param & TreatyParam>
                              ) => Promise<TreatyResponse<Response>>
                        : (
                              body: Body extends Record<string, unknown>
                                  ? ReplaceBlobWithFiles<Body>
                                  : Body,
                              options?: Prettify<Param & TreatyParam>
                          ) => Promise<TreatyResponse<Response>>
                    : K extends 'get' | 'head'
                    ? (
                          options: Prettify<Param & TreatyParam>
                      ) => Promise<TreatyResponse<Response>>
                    : (
                          body: Body extends Record<string, unknown>
                              ? ReplaceBlobWithFiles<Body>
                              : Body,
                          options: Prettify<Param & TreatyParam>
                      ) => Promise<TreatyResponse<Response>>
                : never
            : CreateParams<Route[K]>
    }

    type CreateParams<Route extends Record<string, any>> = Extract<
        keyof Route,
        `:${string}`
    > extends infer Path extends string
        ? IsNever<Path> extends true
            ? Prettify<Sign<Route>>
            : // ! DO NOT USE PRETTIFY ON THIS LINE, OTHERWISE FUNCTION CALLING WILL BE OMITTED
              ((params: {
                  [param in Path extends `:${infer Param}` ? Param : never]:
                      | string
                      | number
              }) => Prettify<Sign<Route[Path]>> & CreateParams<Route[Path]>) &
                  Prettify<Sign<Route>>
        : never

    export interface Config {
        fetch?: Omit<RequestInit, 'headers' | 'method'>
        fetcher?: typeof fetch
        headers?: MaybeArray<
            | RequestInit['headers']
            | ((
                  path: string,
                  options: RequestInit
              ) => RequestInit['headers'] | void)
        >
        onRequest?: MaybeArray<
            (
                path: string,
                options: FetchRequestInit
            ) => MaybePromise<FetchRequestInit | void>
        >
        onResponse?: MaybeArray<(response: Response) => MaybePromise<unknown>>
        keepDomain?: boolean
    }

    type UnwrapAwaited<T extends Record<number, unknown>> = {
        [K in keyof T]: Awaited<T[K]>
    }

    type TreatyResponse<
        _Res extends Record<number, unknown>,
        Res extends Record<
            number,
            unknown
        > = ReplaceGeneratorWithAsyncGenerator<_Res>
    > =
        | {
              data: Res[200]
              error: null
              response: Response
              status: number
              headers: FetchRequestInit['headers']
          }
        | {
              data: null
              error: Exclude<keyof Res, 200> extends never
                  ? {
                        status: unknown
                        value: unknown
                    }
                  : {
                        [Status in keyof Res]: {
                            status: Status
                            value: Res[Status]
                        }
                    }[Exclude<keyof Res, 200>]
              response: Response
              status: number
              headers: FetchRequestInit['headers']
          }

    export interface OnMessage<Data = unknown> extends MessageEvent {
        data: Data
        rawData: MessageEvent['data']
    }

    export type WSEvent<
        K extends keyof WebSocketEventMap,
        Data = unknown
    > = K extends 'message' ? OnMessage<Data> : WebSocketEventMap[K]
}
