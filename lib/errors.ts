export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "document"
  | "suggestions";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  api: "response",
  auth: "response",
  chat: "response",
  database: "log",
  document: "response",
  history: "response",
  stream: "response",
  suggestions: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string | ErrorOptions) {
    const message = getMessageByErrorCode(errorCode);
    const options = typeof cause === "string" ? undefined : cause;

    super(message, options);

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    if (typeof cause === "string") {
      this.cause = cause;
    }
    this.surface = surface as Surface;
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        cause,
        code,
        message,
      });

      return Response.json(
        {
          code: "",
          message: "문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: statusCode }
      );
    }

    return Response.json({ cause, code, message }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "데이터베이스 조회 중 오류가 발생했습니다.";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "요청을 처리할 수 없습니다. 입력값을 확인하고 다시 시도해주세요.";

    case "unauthorized:auth":
      return "계속하려면 로그인이 필요합니다.";
    case "forbidden:auth":
      return "이 기능을 사용할 권한이 없습니다.";

    case "rate_limit:chat":
      return "메시지 한도에 도달했습니다. 1시간 후 다시 대화를 이어가주세요.";
    case "not_found:chat":
      return "요청한 대화를 찾을 수 없습니다. 대화 ID를 확인하고 다시 시도해주세요.";
    case "forbidden:chat":
      return "이 대화는 다른 사용자의 것입니다. 대화 ID를 확인하고 다시 시도해주세요.";
    case "unauthorized:chat":
      return "이 대화를 보려면 로그인이 필요합니다. 로그인 후 다시 시도해주세요.";
    case "offline:chat":
      return "메시지를 보내는 데 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.";

    case "not_found:document":
      return "요청한 문서를 찾을 수 없습니다. 문서 ID를 확인하고 다시 시도해주세요.";
    case "forbidden:document":
      return "이 문서는 다른 사용자의 것입니다. 문서 ID를 확인하고 다시 시도해주세요.";
    case "unauthorized:document":
      return "이 문서를 보려면 로그인이 필요합니다. 로그인 후 다시 시도해주세요.";
    case "bad_request:document":
      return "문서를 생성하거나 수정하는 요청이 올바르지 않습니다. 입력값을 확인하고 다시 시도해주세요.";

    default:
      return "문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
