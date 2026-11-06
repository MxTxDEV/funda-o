"use client";
import { AI_PROVIDER_IDS, AI_PROVIDER_INFO, type AgentAiConfig } from "@vc/ai/catalog";
import { useState } from "react";
import { Field } from "@/components/forms";
import { Input, Select } from "@/components/ui/input";

/**
 * Provider/model selection and execution limits of an employee version. The model list comes from
 * the provider itself (last connection check); credentials never reach the browser.
 */
export function AiSettingsFields({
  provider,
  model,
  config,
  modelOptions,
  configured,
}: {
  provider?: string | null;
  model?: string | null;
  config?: Partial<AgentAiConfig>;
  modelOptions: Record<string, string[]>;
  configured: Record<string, boolean>;
}) {
  const [selected, setSelected] = useState(provider ?? "");
  const models = modelOptions[selected] ?? [];
  const listId = `ai-models-${selected || "none"}`;
  return (
    <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2">
      <p className="text-xs text-muted-foreground md:col-span-2">
        Conexão de IA desta versão. As chaves de API ficam somente no servidor (variáveis de ambiente) — nunca neste formulário.
      </p>
      <Field label="Provedor de IA" name="aiProvider">
        <Select id="aiProvider" name="aiProvider" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">— Sem IA —</option>
          {AI_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>
              {AI_PROVIDER_INFO[id].label}
              {configured[id] ? "" : " (sem credencial no servidor)"}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Modelo"
        name="aiModel"
        hint={
          !selected
            ? undefined
            : models.length
              ? `${models.length} modelo(s) informados pelo provedor na última verificação.`
              : "Verifique a conexão em IA e provedores para carregar a lista oficial de modelos."
        }
      >
        <Input id="aiModel" name="aiModel" defaultValue={model ?? ""} list={listId} maxLength={120} disabled={!selected} placeholder={selected ? "Identificador do modelo" : ""} />
        <datalist id={listId}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Temperatura (opcional)" name="ai_temperature" hint="0 a 2. Vazio = padrão do provedor (alguns modelos não aceitam).">
        <Input id="ai_temperature" name="ai_temperature" type="number" min={0} max={2} step={0.1} defaultValue={config?.temperature ?? ""} disabled={!selected} />
      </Field>
      <Field label="Limite de tokens de saída" name="ai_maxOutputTokens" hint="Máximo gerado por execução.">
        <Input id="ai_maxOutputTokens" name="ai_maxOutputTokens" type="number" min={16} max={64000} defaultValue={config?.maxOutputTokens ?? 2048} disabled={!selected} />
      </Field>
      <Field label="Limite diário de tokens (opcional)" name="ai_dailyTokenLimit">
        <Input id="ai_dailyTokenLimit" name="ai_dailyTokenLimit" type="number" min={1} defaultValue={config?.dailyTokenLimit ?? ""} disabled={!selected} />
      </Field>
      <Field label="Limite diário de custo em US$ (opcional)" name="ai_dailyCostLimitUsd" hint="Exige preço configurado para o modelo.">
        <Input id="ai_dailyCostLimitUsd" name="ai_dailyCostLimitUsd" type="number" min={0} step={0.01} defaultValue={config?.dailyCostLimitUsd ?? ""} disabled={!selected} />
      </Field>
    </div>
  );
}
