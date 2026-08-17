import React from "react";
import type { ContentAiWalkingSkeletonDraft } from "@visepanda/domain";

export function ContentAiWalkingSkeletonPreview({
  draft,
}: {
  draft: ContentAiWalkingSkeletonDraft;
}) {
  return (
    <section className="panel contentAiSkeletonPreview" aria-label="Content AI 验证草稿预览">
      <header>
        <div>
          <p className="eyebrow">CONTENT AI WALKING SKELETON</p>
          <h2>单字段修改预览</h2>
        </div>
        <span className={`statusChip status-${draft.state}`}>{stateLabel(draft.state)}</span>
      </header>
      {draft.state === "conflict" ? (
        <p className="taskError">草稿已过期。请重新读取地点事实后再基于最新版本处理。</p>
      ) : null}
      <dl>
        <div>
          <dt>目标</dt>
          <dd>{draft.poiId}</dd>
        </div>
        <div>
          <dt>字段</dt>
          <dd>最近地铁出口</dd>
        </div>
        <div>
          <dt>风险</dt>
          <dd>执行事实</dd>
        </div>
        <div>
          <dt>预期版本</dt>
          <dd>{draft.expectedFactVersion}</dd>
        </div>
        <div>
          <dt>修改前</dt>
          <dd>{draft.before?.text ?? "尚无已发布值"}</dd>
        </div>
        <div>
          <dt>修改后</dt>
          <dd>{draft.after.text}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{draft.evidence.sourceLocator}</dd>
        </div>
        <div>
          <dt>证据</dt>
          <dd>{draft.evidence.evidenceSummary}</dd>
        </div>
      </dl>
      <p className="muted">这是测试夹具验证界面；不会在生产环境生成或发布硬编码内容。</p>
    </section>
  );
}

function stateLabel(state: ContentAiWalkingSkeletonDraft["state"]) {
  if (state === "published") return "已发布";
  if (state === "conflict") return "需要重新核对";
  return "草稿";
}
