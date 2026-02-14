export function sendResponse<T>(message: string, data?: T) {
  if (data !== undefined) {
    return {
      success: true,
      message,
      data,
    };
  }

  return {
    success: true,
    message,
  };
}
