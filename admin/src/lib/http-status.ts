/** 状态码文字颜色：5xx 严重、4xx 警告，其余常规（总是和数字一起显示，不只靠颜色）。 */
export const statusTone = (status: number | null | undefined) =>
  status === null || status === undefined
    ? 'text-muted-foreground'
    : status >= 500
      ? 'text-critical'
      : status >= 400
        ? 'text-warning'
        : '';
