# Plano de Melhorias — Marcações Platform

> Baseado na análise competitiva com Book.pt e funcionalidades identificadas para atingir paridade + diferenciação.
> Data: 2026-04-12

---

## Estado Atual — O que JÁ TEMOS

| Funcionalidade | Estado |
|---|---|
| Agenda diária/semanal com multi-staff | ✅ Completo |
| Criar marcação via calendário + botão | ✅ Completo |
| Criar marcação interna (cliente existente ou novo) | ✅ Completo |
| Auto-guardar cliente na marcação | ✅ Completo |
| Ficha de cliente com stats básicos | ✅ Completo |
| Serviços com duração, preço, cor, staff associado | ✅ Completo |
| Multi-serviço por booking (modelo agregado) | ✅ Completo |
| Staff com foto, horários, pausas, serviços | ✅ Completo |
| Horário da loja + pausas inline | ✅ Completo |
| Fluxo de aprovação (pendente → confirmada) | ✅ Completo |
| Pagamentos online (Stripe backend) | ⚠️ Backend pronto, sem UI config |
| RBAC (owner/manager/staff/receptionist) | ⚠️ Backend + RLS pronto, sem UI gestão |
| Página pública editorial single-page | ✅ Completo |
| i18n PT/EN | ✅ Completo |
| Notificações via n8n (webhook + HMAC) | ✅ Backend pronto |
| Design editorial (Playfair + DM Sans + gold accent) | ✅ Completo |

---

## Fase 1 — Analytics & Estatísticas Dashboard

**Complexidade: ALTA | Impacto: ALTO | Prioridade: P0**

O owner precisa ver métricas do negócio para perceber o valor da plataforma. Sem isto, churn é alto.

### Funcionalidades

1. **Filtro por período** — date range picker (hoje, esta semana, este mês, custom)
2. **KPIs principais** — nº marcações, faturação, novos clientes, SMS enviados
3. **Gráfico: marcações por dia** — bar chart com afluência diária
4. **Gráfico: faturação por dia** — line chart paralelo
5. **Gráfico: serviços mais marcados** — pie/bar chart top serviços
6. **Gráfico: faturação por colaborador** — para divisão de contas
7. **Gráfico: serviços por colaborador** — quem faz o quê
8. **Gráfico: origem das marcações** — back-office vs online (futuro: Instagram, Facebook)
9. **Tendência 6 meses** — evolução mensal de marcações e faturação
10. **Exportar relatórios** — PDF/CSV

### Melhorias nossas (diferenciação)

- Comparação com período anterior ("+15% vs mês passado")
- Heatmap semanal de ocupação por hora
- Previsão de receita baseada em tendência

### Implementação

- Nova página `/dashboard/analytics`
- Usar Recharts ou Chart.js para gráficos
- Queries server-side com agregações SQL
- Componente DateRangePicker reutilizável

---

## Fase 2 — Ficha de Cliente Enriquecida

**Complexidade: MÉDIA | Impacto: ALTO | Prioridade: P1**

### Funcionalidades

1. **Estatísticas detalhadas** — nº marcações, canceladas, completas, faltas (no-shows)
2. **Histórico completo** — tabela com serviço, colaborador, data, preço, observações
3. **Data de aniversário** — campo no perfil (birthday_date na tabela customers)
4. **Filtros na listagem** — ordenar por nome, nº marcações, última visita, total gasto
5. **Notas/observações** — campo editável na ficha do cliente

### Melhorias nossas

- Score de fidelidade automático (baseado em frequência + recência + valor)
- Alerta "cliente em risco" — não visita há X semanas
- Tag de cliente VIP automático

### Implementação

- ALTER TABLE customers ADD birthday_date date
- Componente de histórico com tabela paginada
- Filtros na listagem (já temos search, adicionar sort options)

---

## Fase 3 — Notificações & Templates Personalizáveis

**Complexidade: MÉDIA | Impacto: ALTO | Prioridade: P0**

### Funcionalidades

1. **Templates de email editáveis** — confirmação, alteração, cancelamento
2. **Templates de SMS editáveis** — mesmos eventos, remetente personalizável
3. **Configuração de antecedência** — lembrete 1h, 2h, 24h, 48h antes
4. **SMS de aniversário** — envio automático com mensagem custom
5. **Preview de templates** — ver como o cliente vai receber
6. **Variáveis dinâmicas** — {{nome}}, {{serviço}}, {{data}}, {{hora}}, {{profissional}}

### Melhorias nossas

- Suporte WhatsApp via n8n (já temos a infra de webhooks)
- Templates com variáveis drag-and-drop
- Histórico de notificações enviadas por cliente

### Implementação

- Nova tabela `notification_templates` (business_id, event_type, channel, subject, body, variables)
- Nova tabela `reminder_settings` (business_id, channel, advance_minutes)
- Página `/dashboard/settings` → sub-tab "Notificações"
- n8n workflows para cada evento

### Dependências

- Provider SMS: Twilio ou MessageBird (custo por mensagem)
- Provider Email: Resend ou SendGrid (free tier disponível)

---

## Fase 4 — Editor da Página Pública

**Complexidade: MÉDIA | Impacto: ALTO | Prioridade: P1**

### Funcionalidades

1. **Toggle online/offline** — desativar marcações temporariamente
2. **Editor de slug** — alterar o URL da página (já temos em settings, melhorar UX)
3. **Upload de logo** — aparece na página pública e no nav
4. **Upload de imagem de capa** — hero banner customizável (Supabase Storage)
5. **Selecção de tema/cores** — presets de cores (gold, blue, green, dark)
6. **Notas de rodapé** — texto livre no final da página
7. **Links redes sociais** — Facebook, Instagram, website
8. **QR Code** — gerado automaticamente com link da página
9. **Opções de personalização:**
   - Permitir/não permitir escolher colaborador
   - Email obrigatório sim/não
   - Pedir NIF sim/não
   - Mostrar preços sim/não
10. **Facebook Pixel** — campo para ID do pixel

### Melhorias nossas

- Preview em tempo real (split screen: editor + preview)
- 4-5 templates pré-definidos (Luxury, Modern, Classic, Minimal, Bold)
- Dark mode para a página pública
- SEO meta tags editáveis (title, description)

### Implementação

- Novos campos em `businesses`: logo_url (já existe), cover_image_url, theme, footer_notes, social_facebook, social_instagram, social_website, booking_page_settings (jsonb)
- Nova página `/dashboard/page-editor`
- Componente QRCode (usar `qrcode` npm package)
- Upload de imagens via Supabase Storage (bucket `business-assets`)

---

## Fase 5 — Marketing & Campanhas

**Complexidade: ALTA | Impacto: MÉDIO | Prioridade: P2**

### Funcionalidades

1. **Criar campanha SMS** — nome, remetente, mensagem, selecção de destinatários
2. **Criar campanha email** — com imagem, botão CTA, texto rico
3. **Campanhas pré-sugeridas** — templates sazonais (Natal, Dia da Mãe, Verão, etc.)
4. **Envio teste** — enviar para o próprio número antes de disparar
5. **Estatísticas de campanha** — enviados, custo, retorno (ROI), marcações geradas
6. **Segmentação** — todos, clientes inativos, aniversariantes, VIPs, etc.

### Melhorias nossas

- Automações: "enviar promoção a clientes que não vêm há 30 dias"
- WhatsApp Business API como canal de campanha
- A/B testing de mensagens
- Link tracking para medir conversões

### Implementação

- Novas tabelas: `campaigns`, `campaign_recipients`, `campaign_stats`
- Nova página `/dashboard/marketing`
- Integração com Twilio/MessageBird (SMS) + Resend (email)
- n8n workflows para envio em batch

### Dependências

- Provider SMS com custos por mensagem
- Compliance: opt-in/opt-out, RGPD

---

## Fase 6 — Gestão de Acessos (UI)

**Complexidade: BAIXA | Impacto: MÉDIO | Prioridade: P1**

> Backend já existe (business_members com roles). Falta apenas o UI.

### Funcionalidades

1. **UI para listar membros** — ver quem tem acesso, com que role
2. **Convidar membro** — por email, escolher role
3. **Alterar role** — promover/despromover
4. **Remover membro** — revogar acesso
5. **Permissões visuais** — mostrar o que cada role pode fazer

### Implementação

- Nova página `/dashboard/team` (ou sub-tab em settings)
- Usar tabela `business_members` existente
- Envio de convite via email (notification_event)

---

## Fase 7 — Extensões & Integrações

**Complexidade: ALTA | Impacto: MÉDIO | Prioridade: P2**

### Funcionalidades

1. **Google Calendar sync** — sincronização bidirecional de marcações
2. **Google Reviews auto-request** — email pós-marcação pedindo review
3. **Widget embed** — iframe/script para integrar no website do cliente
4. **Pagamentos UI** — configuração de métodos (Stripe, MBWay futuro)
5. **Google Reserve** — marcações via Google Business Profile (requer aprovação Google)

### Melhorias nossas

- Página de "extensões" com toggle on/off (marketplace style)
- API pública REST para integrações third-party
- Webhooks customizáveis (já temos n8n)

### Implementação

- Nova página `/dashboard/extensions`
- Google Calendar: OAuth2 + Google Calendar API
- Widget: componente React standalone + script de embed
- Payments UI: página de configuração do Stripe Connect

---

## Fase 8 — Subscrições, Multi-Localização & Compliance

**Complexidade: ALTA | Impacto: MÉDIO | Prioridade: P3**

### Funcionalidades

1. **Gestão de subscrição** — ver plano atual, upgrade/downgrade, cancelar
2. **Faturas** — histórico de pagamentos da plataforma, exportar PDF
3. **Multi-localização** — várias lojas na mesma conta com switch
4. **Programa de fidelização** — pontos/stamps, recompensas configuráveis
5. **RGPD** — consentimento explícito, exportar dados do cliente, direito ao esquecimento

### Implementação

- Stripe Billing para subscrições (já temos Stripe)
- Tabela `locations` para multi-localização
- Tabelas `loyalty_programs`, `loyalty_points`, `loyalty_rewards`
- RGPD: export endpoint + anonymize endpoint

---

## Roadmap Visual

```
Q2 2026 (Abril-Junho)
├── Fase 1: Analytics Dashboard ──────────── [P0] 🔴
├── Fase 3: Notificações & Templates ─────── [P0] 🔴
└── Fase 6: Gestão Acessos UI ────────────── [P1] 🟡 (rápido)

Q3 2026 (Julho-Setembro)
├── Fase 2: Ficha Cliente Enriquecida ────── [P1] 🟡
├── Fase 4: Editor Página Pública ────────── [P1] 🟡
└── Fase 7: Google Calendar + Reviews ────── [P2] 🟢

Q4 2026 (Outubro-Dezembro)
├── Fase 5: Marketing & Campanhas ────────── [P2] 🟢
├── Fase 7: Widget Embed + Payments UI ───── [P2] 🟢
└── Fase 8: Subscrições + Billing ────────── [P3] 🔵

Q1 2027
├── Fase 8: Multi-Localização ────────────── [P3] 🔵
├── Fase 8: Programa Fidelização ─────────── [P3] 🔵
└── Fase 8: RGPD Compliance ──────────────── [P3] 🔵
```

---

## Riscos

| Nível | Risco | Mitigação |
|---|---|---|
| 🔴 ALTO | SMS requer provider pago (Twilio/MessageBird) | Começar só com email (Resend free tier), SMS como upgrade |
| 🔴 ALTO | Google Reserve requer aprovação do programa | Começar com Google Calendar sync + Reviews |
| 🟡 MÉDIO | Editor de página pública é complexo (WYSIWYG) | Abordagem simplificada com presets/toggles, não WYSIWYG |
| 🟡 MÉDIO | Multi-localização requer refactor de business_id | Planear desde já o modelo (locations herdam de business) |
| 🟢 BAIXO | Google Calendar sync tem API bem documentada | Usar googleapis npm package |
| 🟢 BAIXO | Campanhas de marketing requerem compliance | Implementar opt-in/opt-out desde o início |

---

## Stack para as Novas Funcionalidades

| Componente | Tecnologia |
|---|---|
| Gráficos/Charts | Recharts (já temos React) |
| QR Code | `qrcode.react` npm package |
| Email sending | Resend (free tier: 3k emails/mês) |
| SMS sending | Twilio ou MessageBird |
| Google APIs | `googleapis` npm package |
| Rich text editor | TipTap (para templates de email) |
| PDF export | `@react-pdf/renderer` ou `jspdf` |
| Date range picker | `react-day-picker` (já temos) |

---

## Métricas de Sucesso

Para cada fase, medir:

- **Adoção**: % de businesses que usam a funcionalidade
- **Retenção**: churn rate antes/depois
- **Engagement**: nº de vezes que a funcionalidade é usada por semana
- **Revenue**: impacto na conversão free → pro (quando billing existir)
