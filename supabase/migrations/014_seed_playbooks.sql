-- ─────────────────────────────────────────────────────────────────────────
-- Migración 014: Seed de 6 playbooks base para iGEO
--
-- Playbooks pre-cargados con steps razonables basados en el sector
-- B2B de iGEO (sanidad ambiental, control de plagas, Legionella).
-- El admin puede editarlos/duplicarlos/ajustarlos desde la UI.
--
-- Solo inserta si la tabla está vacía (idempotente).
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  v_pb_webinar      uuid;
  v_pb_event        uuid;
  v_pb_release      uuid;
  v_pb_newsletter   uuid;
  v_pb_campaign     uuid;
  v_pb_alliance     uuid;
  v_exists          int;
begin
  -- Salir si ya hay playbooks (re-ejecución segura)
  select count(*) into v_exists from public.playbooks;
  if v_exists > 0 then
    raise notice 'Playbooks ya existen (% filas), saltando seed', v_exists;
    return;
  end if;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. WEBINAR
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.playbooks (
    name, type, description, market_scope, default_channels,
    required_assets, required_copy_blocks, approval_required, active
  ) values (
    'Webinar B2B',
    'webinar',
    'Secuencia completa de promoción de un webinar: anuncio, recordatorios, día del evento, resumen y follow-up.',
    'all',
    array['linkedin','email','newsletter'],
    array['image','landing','cta'],
    array['hook','beneficios','cta','closing'],
    true,
    true
  ) returning id into v_pb_webinar;

  insert into public.playbook_steps (
    playbook_id, step_order, relative_day_offset, channel, task_type,
    title_template, instructions, required, approval_gate
  ) values
    (v_pb_webinar, 0, -14, 'linkedin', 'post',
     'Anuncio webinar: {{event_name}} — {{anchor_date}}',
     'Anunciar el webinar 2 semanas antes. Hook con el problema que resuelve. Nombre del ponente, fecha y hora. CTA claro a la landing de registro.',
     true, true),
    (v_pb_webinar, 1, -14, 'email', 'email',
     'Invitación: {{event_name}}',
     'Email a la base de contactos invitando al webinar. Subject corto. Beneficios concretos (3-4 puntos). CTA prominente. Firmar con el equipo de iGEO.',
     true, true),
    (v_pb_webinar, 2, -7, 'linkedin', 'post',
     'Una semana para {{event_name}}',
     'Refuerzo a 7 días vista. Resaltar 1-2 puntos de la agenda. Recordar fecha/hora. CTA registro.',
     true, true),
    (v_pb_webinar, 3, -2, 'email', 'reminder',
     'Mañana: {{event_name}}',
     'Recordatorio 2 días antes para registrados (segmentar). Confirmar fecha/hora, link de acceso y agenda final.',
     true, true),
    (v_pb_webinar, 4, -1, 'linkedin', 'post',
     'Último aviso: {{event_name}} mañana',
     'Post de último aviso. Tono más urgente. Recordar registro y link directo.',
     true, true),
    (v_pb_webinar, 5, 0, 'linkedin', 'post',
     'Hoy: {{event_name}} en directo',
     'Publicación del día del webinar a primera hora. Generar expectativa, mencionar bonus o regalo si aplica.',
     true, true),
    (v_pb_webinar, 6, 2, 'linkedin', 'post',
     'Resumen webinar {{event_name}}',
     'Post-mortem: 3-5 takeaways clave del webinar. CTA para descargar la grabación o solicitar demo.',
     true, true),
    (v_pb_webinar, 7, 3, 'email', 'follow_up',
     'Follow-up: {{event_name}}',
     'Email a asistentes y registrados (segmentar). Resumen + link a grabación + CTA a próximo paso (demo, descarga PDF).',
     true, true),
    (v_pb_webinar, 8, 7, 'newsletter', 'newsletter',
     'Newsletter — Lo mejor del webinar {{event_name}}',
     'Incluir highlights del webinar en la newsletter del mes. Link al replay. Casos de éxito mencionados.',
     false, true);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. EVENTO PRESENCIAL (Feria, congreso)
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.playbooks (
    name, type, description, market_scope, default_channels,
    required_assets, required_copy_blocks, approval_required, active
  ) values (
    'Evento presencial / Feria',
    'event_presential',
    'Campaña completa para participación en feria o evento presencial: pre, durante y post evento.',
    'all',
    array['linkedin','instagram','email'],
    array['image','banner'],
    array['hook','ubicacion','cta'],
    true,
    true
  ) returning id into v_pb_event;

  insert into public.playbook_steps (
    playbook_id, step_order, relative_day_offset, channel, task_type,
    title_template, instructions, required, approval_gate
  ) values
    (v_pb_event, 0, -21, 'linkedin', 'post',
     'iGEO estará en {{event_name}}',
     'Anuncio inicial de participación. Stand, ubicación, fechas. Equipo que asiste. Invitar a agendar reunión.',
     true, true),
    (v_pb_event, 1, -14, 'instagram', 'post',
     'Te esperamos en {{event_name}}',
     'Post visual de Instagram. Imagen del stand o equipo. Stories con countdown si aplica.',
     true, true),
    (v_pb_event, 2, -7, 'email', 'email',
     'Visítanos en {{event_name}}',
     'Email a clientes y prospectos relevantes. Invitación a pasar por el stand. Posible agenda 1-a-1.',
     true, true),
    (v_pb_event, 3, -2, 'linkedin', 'post',
     '2 días para {{event_name}}',
     'Recordatorio con detalles prácticos: número de stand, horarios, qué se mostrará.',
     true, true),
    (v_pb_event, 4, 0, 'linkedin', 'post',
     'Estamos en {{event_name}}',
     'Publicación durante el evento. Foto del stand o equipo en acción. Invitar a pasar.',
     true, true),
    (v_pb_event, 5, 0, 'instagram', 'post',
     'En directo desde {{event_name}}',
     'Stories e instagram post del evento. Fotos del equipo, conversaciones, demos. Generar FOMO.',
     true, true),
    (v_pb_event, 6, 3, 'linkedin', 'post',
     'Gracias {{event_name}}',
     'Post resumen post-evento. Agradecimiento a visitantes. Highlights y aprendizajes. CTA seguir conversación.',
     true, true),
    (v_pb_event, 7, 5, 'email', 'follow_up',
     'Seguimiento post {{event_name}}',
     'Email a leads capturados en el stand. Recordar conversación, propuesta de demo o reunión.',
     true, true);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. NOVEDAD / RELEASE
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.playbooks (
    name, type, description, market_scope, default_channels,
    required_assets, required_copy_blocks, approval_required, active
  ) values (
    'Lanzamiento de novedad de producto',
    'release',
    'Comunicación de nueva funcionalidad o módulo del ERP iGEO: email a clientes, post social, blog técnico y refuerzo.',
    'all',
    array['email','linkedin','blog'],
    array['image','video'],
    array['que_es','beneficios','como_funciona','cta'],
    true,
    true
  ) returning id into v_pb_release;

  insert into public.playbook_steps (
    playbook_id, step_order, relative_day_offset, channel, task_type,
    title_template, instructions, required, approval_gate
  ) values
    (v_pb_release, 0, 0, 'email', 'email',
     'Nueva funcionalidad: {{event_name}}',
     'Email a base de clientes anunciando la novedad. Hook con el problema que resuelve. 3 beneficios clave. CTA al artículo o demo.',
     true, true),
    (v_pb_release, 1, 0, 'linkedin', 'post',
     'Lanzamos {{event_name}}',
     'Post de lanzamiento en LinkedIn. Imagen o video corto. Tono profesional pero entusiasta. Mencionar a qué tipo de cliente sirve.',
     true, true),
    (v_pb_release, 2, 1, 'blog', 'blog',
     '{{event_name}}: cómo funciona y para quién',
     'Artículo de blog técnico (~800 palabras). Caso de uso real. Capturas de pantalla. SEO keywords del sector.',
     true, true),
    (v_pb_release, 3, 3, 'linkedin', 'post',
     '¿Cómo te ayuda {{event_name}}?',
     'Refuerzo a 3 días. Foco en un beneficio concreto con número o métrica.',
     true, true),
    (v_pb_release, 4, 7, 'linkedin', 'post',
     'Caso real con {{event_name}}',
     'Post con testimonial breve o caso de cliente que ya está usando la funcionalidad.',
     false, true),
    (v_pb_release, 5, 14, 'newsletter', 'newsletter',
     'Newsletter — {{event_name}} y otras novedades',
     'Incluir en la siguiente newsletter mensual como pieza destacada.',
     true, true);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 4. NEWSLETTER MENSUAL
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.playbooks (
    name, type, description, market_scope, default_channels,
    required_assets, required_copy_blocks, approval_required, active
  ) values (
    'Newsletter mensual',
    'newsletter',
    'Newsletter mensual a clientes y suscriptores con secciones fijas: editorial, novedades, recursos y caso de éxito.',
    'all',
    array['newsletter'],
    array['image'],
    array['editorial','novedades','recursos','caso_exito','cta'],
    true,
    true
  ) returning id into v_pb_newsletter;

  insert into public.playbook_steps (
    playbook_id, step_order, relative_day_offset, channel, task_type,
    title_template, instructions, required, approval_gate
  ) values
    (v_pb_newsletter, 0, -7, 'newsletter', 'newsletter',
     'Brief contenido — {{event_name}}',
     'Recopilar contenido del mes: novedades, casos, recursos, métricas. Definir editorial y CTA principal.',
     true, true),
    (v_pb_newsletter, 1, -3, 'newsletter', 'newsletter',
     'Maqueta — {{event_name}}',
     'Montar newsletter con todas las secciones. Editorial inicial, novedades del mes, recursos (descargas/blog), 1 caso de éxito, CTA al equipo comercial.',
     true, true),
    (v_pb_newsletter, 2, 0, 'newsletter', 'newsletter',
     'Envío newsletter {{event_name}}',
     'Envío en horario óptimo (martes/jueves 10:00). Segmentar por mercado si aplica. Tracking de aperturas y clics.',
     true, true),
    (v_pb_newsletter, 3, 7, 'newsletter', 'follow_up',
     'Re-envío no-abren {{event_name}}',
     'Re-envío a no-abridores con subject distinto. Mismo contenido, mismo CTA.',
     false, true);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 5. CAMPAÑA COMERCIAL
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.playbooks (
    name, type, description, market_scope, default_channels,
    required_assets, required_copy_blocks, approval_required, active
  ) values (
    'Campaña comercial',
    'campaign',
    'Campaña outbound combinada email + social + landing para captación de leads en segmento específico.',
    'all',
    array['email','linkedin','blog'],
    array['landing','image','cta'],
    array['problema','solucion','beneficios','prueba_social','cta'],
    true,
    true
  ) returning id into v_pb_campaign;

  insert into public.playbook_steps (
    playbook_id, step_order, relative_day_offset, channel, task_type,
    title_template, instructions, required, approval_gate
  ) values
    (v_pb_campaign, 0, -7, 'blog', 'landing',
     'Landing — {{event_name}}',
     'Crear landing específica para la campaña. Headline con beneficio. Form corto (nombre, email, empresa). Caso de éxito visible.',
     true, true),
    (v_pb_campaign, 1, 0, 'email', 'email',
     'Email 1 — Problema — {{event_name}}',
     'Primer email de la secuencia. Foco en identificar el problema del segmento. Tono consultivo. CTA suave a la landing.',
     true, true),
    (v_pb_campaign, 2, 0, 'linkedin', 'post',
     'Post orgánico — {{event_name}}',
     'Apoyo orgánico en LinkedIn. Hook con dato del sector. Storytelling con cliente real.',
     true, true),
    (v_pb_campaign, 3, 4, 'email', 'email',
     'Email 2 — Solución — {{event_name}}',
     'Segundo email mostrando cómo iGEO resuelve el problema. Específico, con feature o módulo concreto. CTA demo.',
     true, true),
    (v_pb_campaign, 4, 10, 'email', 'email',
     'Email 3 — Caso de éxito — {{event_name}}',
     'Tercer email con testimonial fuerte de cliente. Métrica concreta (% mejora, horas ahorradas, etc.). CTA agendar reunión.',
     true, true),
    (v_pb_campaign, 5, 14, 'email', 'follow_up',
     'Email 4 — Última llamada — {{event_name}}',
     'Cierre de la secuencia. Tono breve y directo. Invitar a responder con pregunta o agendar 15 min.',
     true, true);

  -- ═══════════════════════════════════════════════════════════════════════
  -- 6. ALIANZA / PARTNER
  -- ═══════════════════════════════════════════════════════════════════════
  insert into public.playbooks (
    name, type, description, market_scope, default_channels,
    required_assets, required_copy_blocks, approval_required, active
  ) values (
    'Anuncio de alianza',
    'alliance',
    'Comunicación coordinada de nueva alianza estratégica con partner: anuncio, refuerzos y posible webinar conjunto.',
    'all',
    array['linkedin','email','blog'],
    array['image','banner'],
    array['quien_es_partner','que_aporta','que_aporta_igeo','beneficios_cliente','cta'],
    true,
    true
  ) returning id into v_pb_alliance;

  insert into public.playbook_steps (
    playbook_id, step_order, relative_day_offset, channel, task_type,
    title_template, instructions, required, approval_gate
  ) values
    (v_pb_alliance, 0, 0, 'linkedin', 'post',
     'iGEO + {{event_name}}',
     'Anuncio principal en LinkedIn. Mencionar al partner (taggear si aplica). Logos. Beneficio claro para clientes.',
     true, true),
    (v_pb_alliance, 1, 0, 'email', 'email',
     'Nueva alianza: {{event_name}}',
     'Email a base de clientes anunciando la alianza. Por qué importa para ellos. Próximos pasos.',
     true, true),
    (v_pb_alliance, 2, 2, 'blog', 'blog',
     'iGEO se alía con {{event_name}}: qué supone para nuestros clientes',
     'Artículo extendido en blog. Contexto del partner. Casos de uso conjuntos. Roadmap.',
     true, true),
    (v_pb_alliance, 3, 7, 'linkedin', 'post',
     'Cómo trabajan iGEO y {{event_name}} juntos',
     'Post de refuerzo a 1 semana. Foco en valor concreto. Posible testimonio de cliente piloto.',
     false, true),
    (v_pb_alliance, 4, 30, 'email', 'follow_up',
     '1 mes con {{event_name}}',
     'Email de balance al mes. Primeros resultados o feedback. CTA explorar la integración.',
     false, true);

  raise notice 'Seed de 6 playbooks completado correctamente';
end $$;

-- Verificación
select
  p.name,
  p.type,
  (select count(*) from public.playbook_steps where playbook_id = p.id) as num_steps
from public.playbooks p
order by p.created_at;
