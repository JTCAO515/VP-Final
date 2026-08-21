import type { EarlyAccessPrimaryConcern } from "@visepanda/domain";
import type { WebLocale } from "./locales";

export const LANDING_CONCERN_ORDER = [
  "payment_and_cash",
  "transport_and_navigation",
  "internet_and_essential_apps",
  "language_and_communication",
  "entry_tickets_and_booking",
  "finding_places_and_addresses",
  "food_and_dietary_needs",
  "accommodation_and_check_in",
  "changing_plans_or_getting_help",
  "something_else",
] as const satisfies readonly EarlyAccessPrimaryConcern[];

type ScenarioCopy = Readonly<{ number: string; title: string; body: string }>;
type FaqCopy = Readonly<{ question: string; answer: string }>;

export type LandingCopy = Readonly<{
  skip: string;
  navLabel: string;
  languageLabel: string;
  title: string;
  lead: string;
  form: Readonly<{
    emailLabel: string;
    emailPlaceholder: string;
    concernLegend: string;
    concernHint: string;
    submit: string;
    submitting: string;
    note: string;
    subscribed: string;
    duplicate: string;
    rateLimited: string;
    savedNotDelivered: string;
    unavailable: string;
  }>;
  concerns: Readonly<Record<EarlyAccessPrimaryConcern, string>>;
  preview: Readonly<{
    label: string;
    disclaimer: string;
    canvasLabel: string;
    day: string;
    blocks: string;
    blockTitles: readonly string[];
    blockNotes: readonly string[];
    tags: readonly string[];
    chatLabel: string;
    chatSubhead: string;
    userMessage: string;
    assistantMessage: string;
    state: string;
  }>;
  scenariosTitle: string;
  scenarios: readonly ScenarioCopy[];
  faqTitle: string;
  faqs: readonly FaqCopy[];
  footer: string;
  legal: Readonly<{
    privacy: string;
    terms: string;
    affiliate: string;
    humanHelp: string;
    emergency: string;
  }>;
}>;

const en: LandingCopy = {
  skip: "Skip to main content",
  navLabel: "VisePanda Early Access",
  languageLabel: "Interface language",
  title: "Plan your China trip with AI. Then work through it with confidence.",
  lead: "VisePanda combines a travel conversation with a practical Trip Canvas for independent travel in China.",
  form: {
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    concernLegend: "What worries you most about traveling in China?",
    concernHint: "Optional. Choose one area we should prioritize.",
    submit: "Get free early access",
    submitting: "Joining...",
    note: "The first invited group can try VisePanda free. Your answer helps us prioritize what to verify first.",
    subscribed: "You are on the list. Check your inbox for a confirmation email.",
    duplicate: "This email is already on the Early Access list.",
    rateLimited: "Too many attempts were sent from this network. Please try again later.",
    savedNotDelivered: "Your signup was saved, but the confirmation email could not be sent.",
    unavailable: "Early Access signup is temporarily unavailable. Please try again later.",
  },
  concerns: {
    payment_and_cash: "Payment & cash",
    transport_and_navigation: "Getting around & navigation",
    internet_and_essential_apps: "Internet & essential apps",
    language_and_communication: "Language & communication",
    entry_tickets_and_booking: "Entry, tickets & booking",
    finding_places_and_addresses: "Finding places & Chinese addresses",
    food_and_dietary_needs: "Food & dietary needs",
    accommodation_and_check_in: "Hotels & check-in",
    changing_plans_or_getting_help: "Changing plans or getting help",
    something_else: "Something else",
  },
  preview: {
    label: "Product preview",
    disclaimer: "Illustrative interface - not live travel data",
    canvasLabel: "Trip Canvas",
    day: "Day 1 - Shanghai",
    blocks: "4 blocks",
    blockTitles: ["Morning attraction", "Lunch nearby", "Afternoon museum", "Evening neighborhood"],
    blockNotes: [
      "A calm first stop",
      "Keep the route compact",
      "An indoor option for later",
      "Leave room for a change of plan",
    ],
    tags: [
      "Booking may be required",
      "Near metro",
      "Chinese address available",
      "Better in daytime",
    ],
    chatLabel: "VisePanda",
    chatSubhead: "Planning with context",
    userMessage: "I want a relaxed first day with metro-friendly stops.",
    assistantMessage:
      "I've drafted a calm Day 1. Review the blocks in Trip Canvas, then we can check the practical preparation needed for each one.",
    state: "Static product preview. No booking or payment is taking place.",
  },
  scenariosTitle: "From an idea to a day you can work through.",
  scenarios: [
    {
      number: "01",
      title: "Plan",
      body: "Turn dates, pace and priorities into a visible Trip Canvas.",
    },
    { number: "02", title: "Prepare", body: "See what needs sorting for each place and day." },
    {
      number: "03",
      title: "Adapt",
      body: "Rework the next step honestly when timing or conditions change.",
    },
  ],
  faqTitle: "Two honest answers.",
  faqs: [
    {
      question: "What is VisePanda?",
      answer:
        "VisePanda is an AI planning and execution workspace for independent travel in China. It combines a conversational assistant with a practical Trip Canvas.",
    },
    {
      question: "What does free Early Access include?",
      answer:
        "The first invited group can try VisePanda free as city coverage and execution workflows expand. Invitations are gradual; we do not claim complete city coverage, real-time ticket availability, booking, payment handling, or live human help.",
    },
  ],
  footer: "Independent travel in China, thoughtfully prepared.",
  legal: {
    privacy: "Privacy",
    terms: "Terms",
    affiliate: "Affiliate disclosure",
    humanHelp: "Human Help limits",
    emergency: "Emergency disclaimer",
  },
};

const zh: LandingCopy = {
  ...en,
  skip: "跳到主要内容",
  navLabel: "VisePanda Early Access",
  languageLabel: "界面语言",
  title: "用 AI 规划中国之旅，再从容地把它走完。",
  lead: "VisePanda 将旅行对话与实用的 Trip Canvas 结合，服务于来中国自由行的旅行者。",
  form: {
    ...en.form,
    emailLabel: "邮箱地址",
    concernLegend: "来中国旅行时，你最担心什么？",
    concernHint: "可选。请选择一个我们应优先解决的方向。",
    submit: "申请免费 Early Access",
    submitting: "正在提交...",
    note: "首批受邀用户可免费试用 VisePanda。你的选择将帮助我们确定优先核实哪些旅行信息。",
    subscribed: "你已加入名单，请查看收件箱中的确认邮件。",
    duplicate: "这个邮箱已在 Early Access 名单中。",
    rateLimited: "此网络提交次数过多，请稍后重试。",
    savedNotDelivered: "你的申请已保存，但确认邮件未能发送。",
    unavailable: "Early Access 暂时不可用，请稍后重试。",
  },
  concerns: {
    payment_and_cash: "支付与现金",
    transport_and_navigation: "出行与导航",
    internet_and_essential_apps: "网络与常用 App",
    language_and_communication: "语言与沟通",
    entry_tickets_and_booking: "入境、门票与预约",
    finding_places_and_addresses: "找地点与中文地址",
    food_and_dietary_needs: "餐饮与饮食需求",
    accommodation_and_check_in: "酒店与入住",
    changing_plans_or_getting_help: "变更计划或寻求帮助",
    something_else: "其他",
  },
  preview: {
    ...en.preview,
    label: "产品预览",
    disclaimer: "示例界面，并非实时旅行数据",
    canvasLabel: "Trip Canvas",
    day: "第 1 天 - 上海",
    blocks: "4 个安排",
    blockTitles: ["上午景点", "附近午餐", "下午博物馆", "傍晚街区"],
    blockNotes: ["平静地开始第一站", "让路线保持紧凑", "下午的室内选择", "为计划变化留出空间"],
    tags: ["可能需要预约", "靠近地铁", "提供中文地址", "建议白天前往"],
    chatSubhead: "结合上下文规划",
    userMessage: "我想安排一个节奏轻松、靠近地铁的第一天。",
    assistantMessage: "我已拟好轻松的第一天。先在 Trip Canvas 查看安排，再逐项确认所需准备。",
    state: "静态产品预览，不涉及预订或付款。",
  },
  scenariosTitle: "从一个想法，到可以实际执行的一天。",
  scenarios: [
    { number: "01", title: "规划", body: "把日期、节奏与优先事项整理成可见的 Trip Canvas。" },
    { number: "02", title: "准备", body: "了解每个地点和每一天需要提前处理的事项。" },
    { number: "03", title: "调整", body: "当时间或条件变化时，诚实地重新安排下一步。" },
  ],
  faqTitle: "两个诚实的回答。",
  faqs: [
    {
      question: "VisePanda 是什么？",
      answer:
        "VisePanda 是面向来中国自由行的 AI 规划与执行工作台，结合对话助手与实用的 Trip Canvas。",
    },
    {
      question: "免费 Early Access 包含什么？",
      answer:
        "随着城市内容与执行工作流逐步完善，首批受邀用户可免费试用。邀请会分批开放；我们不会宣称完整城市覆盖、实时票务、代订、代付款或实时人工服务。",
    },
  ],
  footer: "为中国自由行做好周到准备。",
  legal: {
    privacy: "隐私",
    terms: "条款",
    affiliate: "合作披露",
    humanHelp: "人工协助限制",
    emergency: "紧急情况说明",
  },
};

const es: LandingCopy = {
  ...en,
  skip: "Ir al contenido principal",
  navLabel: "Acceso anticipado de VisePanda",
  languageLabel: "Idioma de la interfaz",
  title: "Planifica tu viaje a China con IA. Luego recórrelo con confianza.",
  lead: "VisePanda combina una conversación de viaje con un Trip Canvas práctico para viajar por China de forma independiente.",
  form: {
    ...en.form,
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    concernLegend: "¿Qué te preocupa más de viajar por China?",
    concernHint: "Opcional. Elige un área que debamos priorizar.",
    submit: "Obtener acceso anticipado gratuito",
    submitting: "Uniéndote...",
    note: "El primer grupo invitado podrá probar VisePanda gratis. Tu respuesta nos ayuda a decidir qué verificar primero.",
    subscribed: "Estás en la lista. Revisa tu correo para ver la confirmación.",
    duplicate: "Este correo ya está en la lista de acceso anticipado.",
    rateLimited: "Se enviaron demasiados intentos desde esta red. Inténtalo más tarde.",
    savedNotDelivered: "Tu registro se guardó, pero no pudimos enviar el correo de confirmación.",
    unavailable: "El registro de acceso anticipado no está disponible ahora. Inténtalo más tarde.",
  },
  concerns: {
    payment_and_cash: "Pagos y efectivo",
    transport_and_navigation: "Transporte y navegación",
    internet_and_essential_apps: "Internet y aplicaciones esenciales",
    language_and_communication: "Idioma y comunicación",
    entry_tickets_and_booking: "Entrada, entradas y reservas",
    finding_places_and_addresses: "Encontrar lugares y direcciones chinas",
    food_and_dietary_needs: "Comida y necesidades dietéticas",
    accommodation_and_check_in: "Hoteles y check-in",
    changing_plans_or_getting_help: "Cambiar planes u obtener ayuda",
    something_else: "Otra cosa",
  },
  preview: {
    ...en.preview,
    label: "Vista previa del producto",
    disclaimer: "Interfaz ilustrativa, no datos de viaje en directo",
    canvasLabel: "Trip Canvas",
    day: "Día 1 - Shanghái",
    blocks: "4 bloques",
    blockTitles: [
      "Atracción matinal",
      "Almuerzo cerca",
      "Museo por la tarde",
      "Barrio por la noche",
    ],
    blockNotes: [
      "Una primera parada tranquila",
      "Mantén la ruta compacta",
      "Una opción interior para más tarde",
      "Deja espacio para cambiar el plan",
    ],
    tags: [
      "Puede requerir reserva",
      "Cerca del metro",
      "Dirección en chino disponible",
      "Mejor de día",
    ],
    chatSubhead: "Planificación con contexto",
    userMessage: "Quiero un primer día tranquilo con paradas cerca del metro.",
    assistantMessage:
      "He preparado un Día 1 tranquilo. Revisa los bloques en Trip Canvas y luego veremos la preparación práctica de cada uno.",
    state: "Vista previa estática. No se realiza ninguna reserva ni pago.",
  },
  scenariosTitle: "De una idea a un día que puedes recorrer.",
  scenarios: [
    {
      number: "01",
      title: "Planifica",
      body: "Convierte fechas, ritmo y prioridades en un Trip Canvas visible.",
    },
    { number: "02", title: "Prepárate", body: "Ve qué debes resolver para cada lugar y cada día." },
    {
      number: "03",
      title: "Adáptate",
      body: "Reorganiza honestamente el siguiente paso cuando cambien el tiempo o las condiciones.",
    },
  ],
  faqTitle: "Dos respuestas honestas.",
  faqs: [
    {
      question: "¿Qué es VisePanda?",
      answer:
        "VisePanda es un espacio de trabajo de planificación y ejecución con IA para viajar de forma independiente por China. Combina un asistente conversacional con un Trip Canvas práctico.",
    },
    {
      question: "¿Qué incluye el acceso anticipado gratuito?",
      answer:
        "El primer grupo invitado podrá probar VisePanda gratis a medida que ampliamos las ciudades y los flujos de ejecución. Las invitaciones son graduales; no afirmamos cobertura completa, disponibilidad de entradas en tiempo real, reservas, pagos ni ayuda humana en directo.",
    },
  ],
  footer: "Viajes independientes por China, preparados con cuidado.",
  legal: {
    privacy: "Privacidad",
    terms: "Términos",
    affiliate: "Divulgación de afiliados",
    humanHelp: "Límites de ayuda humana",
    emergency: "Aviso de emergencia",
  },
};

const ru: LandingCopy = {
  ...en,
  skip: "Перейти к основному содержимому",
  navLabel: "Ранний доступ VisePanda",
  languageLabel: "Язык интерфейса",
  title: "Спланируйте поездку в Китай с ИИ. Затем уверенно пройдите её по плану.",
  lead: "VisePanda объединяет разговор о поездке с практичной Trip Canvas для самостоятельного путешествия по Китаю.",
  form: {
    ...en.form,
    emailLabel: "Электронная почта",
    concernLegend: "Что больше всего беспокоит вас в поездке по Китаю?",
    concernHint:
      "Необязательно. Выберите одну область, которой нам стоит заняться в первую очередь.",
    submit: "Получить бесплатный ранний доступ",
    submitting: "Отправка...",
    note: "Первая приглашённая группа сможет попробовать VisePanda бесплатно. Ваш ответ поможет определить, что проверять в первую очередь.",
    subscribed: "Вы в списке. Проверьте почту для подтверждения.",
    duplicate: "Этот адрес уже есть в списке раннего доступа.",
    rateLimited: "С этой сети отправлено слишком много попыток. Повторите позже.",
    savedNotDelivered: "Ваша заявка сохранена, но письмо с подтверждением не удалось отправить.",
    unavailable: "Регистрация раннего доступа временно недоступна. Повторите позже.",
  },
  concerns: {
    payment_and_cash: "Оплата и наличные",
    transport_and_navigation: "Транспорт и навигация",
    internet_and_essential_apps: "Интернет и важные приложения",
    language_and_communication: "Язык и общение",
    entry_tickets_and_booking: "Въезд, билеты и бронирование",
    finding_places_and_addresses: "Поиск мест и китайских адресов",
    food_and_dietary_needs: "Еда и диетические потребности",
    accommodation_and_check_in: "Отели и заселение",
    changing_plans_or_getting_help: "Изменение планов или получение помощи",
    something_else: "Другое",
  },
  preview: {
    ...en.preview,
    label: "Предпросмотр продукта",
    disclaimer: "Иллюстративный интерфейс, не актуальные данные о поездке",
    canvasLabel: "Trip Canvas",
    day: "День 1 - Шанхай",
    blocks: "4 блока",
    blockTitles: ["Утренняя достопримечательность", "Обед рядом", "Музей днём", "Вечерний район"],
    blockNotes: [
      "Спокойная первая остановка",
      "Сохраните маршрут компактным",
      "Вариант в помещении на потом",
      "Оставьте место для изменения плана",
    ],
    tags: [
      "Может потребоваться бронирование",
      "Рядом с метро",
      "Есть китайский адрес",
      "Лучше днём",
    ],
    chatSubhead: "Планирование с контекстом",
    userMessage: "Я хочу спокойный первый день с остановками рядом с метро.",
    assistantMessage:
      "Я подготовил спокойный первый день. Просмотрите блоки в Trip Canvas, затем проверим практическую подготовку для каждого из них.",
    state: "Статический предпросмотр продукта. Бронирование и оплата не выполняются.",
  },
  scenariosTitle: "От идеи до дня, который можно пройти по плану.",
  scenarios: [
    {
      number: "01",
      title: "Планируйте",
      body: "Превратите даты, темп и приоритеты в наглядную Trip Canvas.",
    },
    {
      number: "02",
      title: "Подготовьтесь",
      body: "Узнайте, что нужно решить для каждого места и дня.",
    },
    {
      number: "03",
      title: "Адаптируйтесь",
      body: "Честно пересмотрите следующий шаг, когда меняются время или условия.",
    },
  ],
  faqTitle: "Два честных ответа.",
  faqs: [
    {
      question: "Что такое VisePanda?",
      answer:
        "VisePanda — это рабочее пространство с ИИ для планирования и выполнения самостоятельной поездки в Китай. Оно объединяет разговорного помощника с практичной Trip Canvas.",
    },
    {
      question: "Что включает бесплатный ранний доступ?",
      answer:
        "Первая приглашённая группа сможет попробовать VisePanda бесплатно по мере расширения городов и сценариев выполнения. Приглашения выдаются постепенно; мы не заявляем полное покрытие городов, наличие билетов в реальном времени, бронирование, оплату или живую помощь человека.",
    },
  ],
  footer: "Самостоятельные поездки по Китаю, подготовленные вдумчиво.",
  legal: {
    privacy: "Конфиденциальность",
    terms: "Условия",
    affiliate: "Раскрытие партнёрства",
    humanHelp: "Ограничения помощи человека",
    emergency: "Экстренная информация",
  },
};

const ar: LandingCopy = {
  ...en,
  skip: "انتقل إلى المحتوى الرئيسي",
  navLabel: "الوصول المبكر إلى VisePanda",
  languageLabel: "لغة الواجهة",
  title: "خطط لرحلتك إلى الصين بالذكاء الاصطناعي، ثم نفذها بثقة.",
  lead: "يجمع VisePanda بين محادثة عن السفر وTrip Canvas عملية للسفر المستقل في الصين.",
  form: {
    ...en.form,
    emailLabel: "البريد الإلكتروني",
    concernLegend: "ما أكثر ما يقلقك بشأن السفر في الصين؟",
    concernHint: "اختياري. اختر مجالاً واحداً ينبغي أن نعطيه الأولوية.",
    submit: "احصل على وصول مبكر مجاني",
    submitting: "جارٍ الانضمام...",
    note: "يمكن للمجموعة المدعوة الأولى تجربة VisePanda مجاناً. تساعدنا إجابتك على تحديد ما يجب التحقق منه أولاً.",
    subscribed: "أنت على القائمة. تحقق من بريدك الإلكتروني للتأكيد.",
    duplicate: "هذا البريد موجود بالفعل في قائمة الوصول المبكر.",
    rateLimited: "تم إرسال محاولات كثيرة من هذه الشبكة. حاول لاحقاً.",
    savedNotDelivered: "تم حفظ طلبك، لكن تعذر إرسال رسالة التأكيد.",
    unavailable: "تسجيل الوصول المبكر غير متاح مؤقتاً. حاول لاحقاً.",
  },
  concerns: {
    payment_and_cash: "الدفع والنقد",
    transport_and_navigation: "التنقل والملاحة",
    internet_and_essential_apps: "الإنترنت والتطبيقات الأساسية",
    language_and_communication: "اللغة والتواصل",
    entry_tickets_and_booking: "الدخول والتذاكر والحجوزات",
    finding_places_and_addresses: "العثور على الأماكن والعناوين الصينية",
    food_and_dietary_needs: "الطعام والاحتياجات الغذائية",
    accommodation_and_check_in: "الفنادق وتسجيل الوصول",
    changing_plans_or_getting_help: "تغيير الخطط أو طلب المساعدة",
    something_else: "شيء آخر",
  },
  preview: {
    ...en.preview,
    label: "معاينة المنتج",
    disclaimer: "واجهة توضيحية وليست بيانات سفر مباشرة",
    canvasLabel: "Trip Canvas",
    day: "اليوم الأول - شنغهاي",
    blocks: "4 محطات",
    blockTitles: ["معلم صباحي", "غداء قريب", "متحف بعد الظهر", "حي مسائي"],
    blockNotes: [
      "بداية هادئة",
      "حافظ على المسار قصيراً",
      "خيار داخلي لوقت لاحق",
      "اترك مجالاً لتغيير الخطة",
    ],
    tags: ["قد يتطلب حجزاً", "قريب من المترو", "العنوان الصيني متاح", "أفضل في النهار"],
    chatSubhead: "تخطيط مع السياق",
    userMessage: "أريد يوماً أول هادئاً مع محطات قريبة من المترو.",
    assistantMessage:
      "أعددت يوماً أول هادئاً. راجع المحطات في Trip Canvas، ثم نتحقق من التحضير العملي لكل منها.",
    state: "معاينة ثابتة للمنتج. لا يجري أي حجز أو دفع.",
  },
  scenariosTitle: "من فكرة إلى يوم يمكنك تنفيذه.",
  scenarios: [
    {
      number: "01",
      title: "خطط",
      body: "حوّل التواريخ والوتيرة والأولويات إلى Trip Canvas واضحة.",
    },
    { number: "02", title: "استعد", body: "اعرف ما يلزم ترتيبه لكل مكان ولكل يوم." },
    {
      number: "03",
      title: "تكيّف",
      body: "أعد ترتيب الخطوة التالية بصدق عندما يتغير الوقت أو الظروف.",
    },
  ],
  faqTitle: "إجابتان صريحتان.",
  faqs: [
    {
      question: "ما هو VisePanda؟",
      answer:
        "VisePanda هو مساحة عمل بالذكاء الاصطناعي لتخطيط وتنفيذ السفر المستقل في الصين، تجمع مساعداً حوارياً مع Trip Canvas عملية.",
    },
    {
      question: "ماذا يشمل الوصول المبكر المجاني؟",
      answer:
        "يمكن للمجموعة المدعوة الأولى تجربة VisePanda مجاناً بينما تتوسع تغطية المدن ومسارات التنفيذ. تتم الدعوات تدريجياً؛ ولا ندعي تغطية كاملة للمدن أو توفر تذاكر مباشر أو حجزاً أو دفعاً أو مساعدة بشرية حية.",
    },
  ],
  footer: "سفر مستقل في الصين، مُعد بعناية.",
  legal: {
    privacy: "الخصوصية",
    terms: "الشروط",
    affiliate: "إفصاح الشراكة",
    humanHelp: "حدود المساعدة البشرية",
    emergency: "إخلاء مسؤولية الطوارئ",
  },
};

const COPIES: Readonly<Record<WebLocale, LandingCopy>> = { en, "zh-CN": zh, es, ar, ru };

export function landingCopyFor(locale: WebLocale): LandingCopy {
  return COPIES[locale] ?? en;
}
