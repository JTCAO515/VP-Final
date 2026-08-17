import type { OpsRole } from "@visepanda/app-server/ops-authorization";
import type { PoiCategory } from "@visepanda/domain";

export function displayOpsRole(role: OpsRole): string {
  switch (role) {
    case "admin":
      return "运营管理员";
    case "editor":
      return "知识编辑";
    case "operator":
      return "人工协助专员";
  }
}

export function displayLifecycleValue(value: string): string {
  const labels: Record<string, string> = {
    active: "有效",
    all: "全部",
    cancelled: "已取消",
    deprecated: "已废弃",
    done: "已完成",
    draft: "草稿",
    error: "出错",
    ignored: "已忽略",
    near_expiry: "即将到期",
    open: "待处理",
    pending: "待启用",
    payment_pending: "待支付",
    paid: "已支付",
    fulfilling: "处理中",
    quoted: "已报价",
    ready: "就绪",
    rejected: "已拒绝",
    requested: "已提交",
    resolved: "已解决",
    reviewed: "已核验",
    saving: "保存中",
    triaged: "已分诊",
    unavailable: "不可用",
  };
  return labels[value] ?? value;
}

export function displayPoiCategory(category: PoiCategory): string {
  const labels: Record<PoiCategory, string> = {
    attraction: "景点",
    experience: "体验",
    food: "餐饮",
    hotel: "酒店",
    shopping: "购物",
  };
  return labels[category];
}

export function displayHumanTaskEvidenceKind(kind: "outcome" | "transcript_excerpt"): string {
  return kind === "outcome" ? "处理结果" : "已脱敏的对话摘录";
}

export function displayHumanTaskKind(kind: string): string {
  const labels: Record<string, string> = {
    call_restaurant: "餐厅沟通",
    other: "其他协助",
    ticket_help: "票务协助",
    translation_help: "翻译协助",
    transport_help: "交通协助",
  };
  return labels[kind] ?? kind;
}
