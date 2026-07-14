export interface HttpClient {
    get<T>(url: string, headers?: Record<string, string>): Promise<T>;
    getBinary?(url: string, headers?: Record<string, string>): Promise<ArrayBuffer>;
    post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    put<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    patch<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    delete<T>(url: string, headers?: Record<string, string>): Promise<T>;
}