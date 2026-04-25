/**
 * advanced-unit-content.ts
 *
 * Content for Spanish 3, 4, and 5 advanced units.
 * Includes curated vocabulary, authentic reading passages, and cultural notes in Spanish.
 *
 * Reading passages draw from public-domain literary works and original cultural texts.
 * Cultural notes are written in Spanish at the appropriate level.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdvancedVocabWord {
  spanish: string;
  english: string;
  partOfSpeech: "sustantivo" | "verbo" | "adjetivo" | "adverbio" | "frase";
  example?: string;
  exampleTranslation?: string;
}

export interface ReadingPassage {
  title: string;
  author?: string;
  year?: string;
  sourceType: "literatura" | "poesía" | "noticias" | "cultural" | "ensayo";
  body: string;
}

export interface CulturalNote {
  heading: string;
  body: string;
}

export interface AdvancedUnitContent {
  unitId: string;
  topicLabel: string;
  levelBadge: string;
  vocabulary: AdvancedVocabWord[];
  reading: ReadingPassage;
  culturalNote: CulturalNote;
}

// ── Spanish 3 — Intermediate High (B1–B2) ────────────────────────────────────

const sp3_identity: AdvancedUnitContent = {
  unitId: "ef9ab9df-56a0-409d-92a4-c3a09eca2d28",
  topicLabel: "Identidad y Sociedad",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "la identidad", english: "identity", partOfSpeech: "sustantivo", example: "La identidad cultural define quiénes somos.", exampleTranslation: "Cultural identity defines who we are." },
    { spanish: "la ciudadanía", english: "citizenship", partOfSpeech: "sustantivo", example: "La ciudadanía implica derechos y responsabilidades.", exampleTranslation: "Citizenship implies rights and responsibilities." },
    { spanish: "la igualdad", english: "equality", partOfSpeech: "sustantivo", example: "Luchamos por la igualdad de oportunidades.", exampleTranslation: "We fight for equality of opportunity." },
    { spanish: "el prejuicio", english: "prejudice", partOfSpeech: "sustantivo", example: "Los prejuicios limitan nuestra comprensión del otro.", exampleTranslation: "Prejudices limit our understanding of others." },
    { spanish: "la diversidad", english: "diversity", partOfSpeech: "sustantivo", example: "La diversidad enriquece a toda la sociedad.", exampleTranslation: "Diversity enriches all of society." },
    { spanish: "los derechos", english: "rights", partOfSpeech: "sustantivo", example: "Todos tenemos derecho a la educación.", exampleTranslation: "We all have the right to education." },
    { spanish: "la solidaridad", english: "solidarity", partOfSpeech: "sustantivo", example: "La solidaridad une a las comunidades en tiempos difíciles.", exampleTranslation: "Solidarity unites communities in difficult times." },
    { spanish: "la discriminación", english: "discrimination", partOfSpeech: "sustantivo", example: "La discriminación por origen es inaceptable.", exampleTranslation: "Discrimination based on origin is unacceptable." },
    { spanish: "pertenecer", english: "to belong", partOfSpeech: "verbo", example: "Todos queremos pertenecer a una comunidad.", exampleTranslation: "We all want to belong to a community." },
    { spanish: "superar", english: "to overcome", partOfSpeech: "verbo", example: "Es posible superar los obstáculos con esfuerzo.", exampleTranslation: "It is possible to overcome obstacles with effort." },
  ],
  reading: {
    title: "Nuestra América",
    author: "José Martí",
    year: "1891",
    sourceType: "ensayo",
    body:
      "Los jóvenes de América se ponen la camisa al codo, hunden las manos en la masa y la levantan con la levadura de su sudor. Entienden que se imita demasiado, y que la salvación está en crear. Crear es la palabra de pase de esta generación.\n\nCon los oprimidos había que hacer causa común, para afianzar el sistema opuesto a los intereses y hábitos de mando de los opresores. El tigre, espantado del fogonazo, vuelve de noche al lugar de la presa. Muere echando llamas por los ojos y con las zarpas al aire. No se le oye venir, sino que viene con zarpas de terciopelo. Cuando la presa despierta, tiene al tigre encima.",
  },
  culturalNote: {
    heading: "La identidad latinoamericana: raíces y orgullo",
    body:
      "La identidad latinoamericana es un mosaico extraordinario de influencias indígenas, europeas y africanas. En países como México, Guatemala, Perú y Bolivia, las culturas originarias —azteca, maya, quechua, aymara— siguen siendo una parte viva e inseparable de la identidad nacional. Sus lenguas, sus ceremonias, su medicina y su cosmología no son reliquias del pasado: son realidades del presente.\n\nLos jóvenes latinoamericanos de hoy exploran esta herencia con orgullo renovado. Movimientos de reafirmación cultural celebran lo indígena y lo afrolatino como fuentes de riqueza, no de vergüenza. La pregunta '¿quiénes somos?' es, en América Latina, tanto una pregunta filosófica como una pregunta política. Responderse a uno mismo implica también reconocer a los otros.",
  },
};

const sp3_arts: AdvancedUnitContent = {
  unitId: "28cbbcfd-0adc-4afe-8836-623bf06cb457",
  topicLabel: "Arte y Literatura",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "la novela", english: "novel", partOfSpeech: "sustantivo", example: "La novela es el género literario más popular del siglo XX.", exampleTranslation: "The novel is the most popular literary genre of the 20th century." },
    { spanish: "el poema", english: "poem", partOfSpeech: "sustantivo", example: "Rubén Darío escribió poemas de gran musicalidad.", exampleTranslation: "Rubén Darío wrote poems of great musicality." },
    { spanish: "el personaje", english: "character", partOfSpeech: "sustantivo", example: "Don Quijote es el personaje más famoso de la literatura española.", exampleTranslation: "Don Quijote is the most famous character in Spanish literature." },
    { spanish: "el argumento", english: "plot", partOfSpeech: "sustantivo", example: "El argumento de la obra es complejo y apasionante.", exampleTranslation: "The plot of the work is complex and exciting." },
    { spanish: "el verso", english: "verse / line of poetry", partOfSpeech: "sustantivo", example: "El primer verso del poema es unforgettable.", exampleTranslation: "The first verse of the poem is unforgettable." },
    { spanish: "la metáfora", english: "metaphor", partOfSpeech: "sustantivo", example: "El poeta usa una metáfora del mar para hablar del amor.", exampleTranslation: "The poet uses a metaphor of the sea to talk about love." },
    { spanish: "narrar", english: "to narrate", partOfSpeech: "verbo", example: "El autor narra la historia desde el punto de vista del niño.", exampleTranslation: "The author narrates the story from the child's point of view." },
    { spanish: "la obra", english: "work (of art or literature)", partOfSpeech: "sustantivo", example: "Esta obra maestra fue escrita en el siglo XVII.", exampleTranslation: "This masterpiece was written in the 17th century." },
    { spanish: "el género", english: "genre", partOfSpeech: "sustantivo", example: "El realismo mágico es un género literario latinoamericano.", exampleTranslation: "Magical realism is a Latin American literary genre." },
    { spanish: "conmover", english: "to move / to touch emotionally", partOfSpeech: "verbo", example: "La última escena de la novela logra conmover al lector.", exampleTranslation: "The last scene of the novel manages to move the reader." },
  ],
  reading: {
    title: "Sonatina",
    author: "Rubén Darío",
    year: "1896",
    sourceType: "poesía",
    body:
      "La princesa está triste... ¿qué tendrá la princesa?\nLos suspiros se escapan de su boca de fresa,\nque ha perdido la risa, que ha perdido el color.\nLa princesa está pálida en su silla de oro,\nestá mudo el teclado de su clave sonoro,\ny en un vaso, olvidada, se desmaya una flor.\n\n¡Oh, quién fuera hipsipila que dejó la crisálida!\n(La princesa está triste. La princesa está pálida.)\n¡Oh visión adorada de oro, rosa y marfil!\n¡Quién volara a la tierra donde un príncipe existe\n(La princesa está pálida. La princesa está triste.)\nmás brillante que el alba, más hermoso que abril!",
  },
  culturalNote: {
    heading: "El Modernismo y el boom literario latinoamericano",
    body:
      "El Modernismo hispanoamericano, movimiento literario de finales del siglo XIX, revolucionó la literatura en español. Su figura central fue el nicaragüense Rubén Darío (1867–1916), quien introdujo una nueva musicalidad, riqueza de imágenes y libertad formal que transformó la poesía para siempre.\n\nDecadas después, el llamado 'boom' latinoamericano de los años 60 y 70 llevó la novela hispanoamericana al centro del escenario mundial. Autores como Gabriel García Márquez (Colombia), Mario Vargas Llosa (Perú), Julio Cortázar (Argentina) e Isabel Allende (Chile) conquistaron lectores en todo el planeta con narraciones que mezclaban lo cotidiano con lo fantástico, la historia con el mito.\n\nHoy, la literatura en español sigue siendo una de las más vibrantes del mundo, con voces nuevas que llegan de México, España, Argentina, Cuba y muchos otros países.",
  },
};

const sp3_history: AdvancedUnitContent = {
  unitId: "7064a217-c352-4fd7-a725-ce141886de9f",
  topicLabel: "Historia y Herencia",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "la civilización", english: "civilization", partOfSpeech: "sustantivo", example: "La civilización maya desarrolló un calendario muy preciso.", exampleTranslation: "The Mayan civilization developed a very precise calendar." },
    { spanish: "la conquista", english: "conquest", partOfSpeech: "sustantivo", example: "La conquista española transformó el continente americano.", exampleTranslation: "The Spanish conquest transformed the American continent." },
    { spanish: "la independencia", english: "independence", partOfSpeech: "sustantivo", example: "México declaró su independencia en 1810.", exampleTranslation: "Mexico declared its independence in 1810." },
    { spanish: "la herencia", english: "heritage / inheritance", partOfSpeech: "sustantivo", example: "La herencia cultural indígena sigue viva en la música y la cocina.", exampleTranslation: "The indigenous cultural heritage lives on in music and cuisine." },
    { spanish: "el mestizaje", english: "racial and cultural mixing", partOfSpeech: "sustantivo", example: "El mestizaje es una característica esencial de América Latina.", exampleTranslation: "Racial and cultural mixing is an essential characteristic of Latin America." },
    { spanish: "la arqueología", english: "archaeology", partOfSpeech: "sustantivo", example: "La arqueología ha revelado ciudades prehispánicas increíbles.", exampleTranslation: "Archaeology has revealed incredible pre-Hispanic cities." },
    { spanish: "el monumento", english: "monument", partOfSpeech: "sustantivo", example: "Machu Picchu es uno de los monumentos más visitados del mundo.", exampleTranslation: "Machu Picchu is one of the most visited monuments in the world." },
    { spanish: "colonizar", english: "to colonize", partOfSpeech: "verbo", example: "España colonizó gran parte de América en el siglo XVI.", exampleTranslation: "Spain colonized much of America in the 16th century." },
    { spanish: "resistir", english: "to resist", partOfSpeech: "verbo", example: "Muchos pueblos indígenas resistieron durante décadas.", exampleTranslation: "Many indigenous peoples resisted for decades." },
    { spanish: "la revolución", english: "revolution", partOfSpeech: "sustantivo", example: "La Revolución Mexicana de 1910 cambió la historia del país.", exampleTranslation: "The Mexican Revolution of 1910 changed the country's history." },
  ],
  reading: {
    title: "Sor Juana Inés de la Cruz: la décima musa",
    sourceType: "cultural",
    body:
      "Sor Juana Inés de la Cruz fue una de las figuras más extraordinarias del mundo hispano. Nacida en México en 1648, aprendió a leer a los tres años y dominó el latín de manera autodidacta. En una época en que la educación formal estaba prohibida para las mujeres, Sor Juana escribió poesía, teatro y ensayos filosóficos de una profundidad asombrosa.\n\nUno de sus poemas más célebres comienza así:\n\n\"Hombres necios que acusáis\na la mujer sin razón,\nsin ver que sois la ocasión\nde lo mismo que culpáis.\"\n\nSor Juana fue también la primera escritora feminista de América. Su obra desafió los límites impuestos por la Iglesia y la sociedad colonial, y su legado sigue siendo una inspiración cuatro siglos después.",
  },
  culturalNote: {
    heading: "Las civilizaciones indígenas y su legado vivo",
    body:
      "Las civilizaciones prehispánicas de América Latina dejaron un legado arquitectónico, científico y cultural que sigue asombrando al mundo. Los mayas desarrollaron uno de los sistemas de escritura más complejos del continente y crearon un calendario de una precisión impresionante. Los aztecas construyeron Tenochtitlán, una ciudad que rivalizaba con las capitales europeas de su época. Los incas edificaron Machu Picchu en las alturas de los Andes, una obra maestra de ingeniería sin herramientas de metal ni rueda.\n\nEste legado no es solo arqueológico: millones de latinoamericanos hablan hoy lenguas indígenas como el náhuatl, el quechua, el maya o el guaraní. Las tradiciones médicas, culinarias y espirituales de estos pueblos forman parte activa de la vida cotidiana de la región. Conocer esta historia es comprender mejor a América Latina tal como es hoy.",
  },
};

const sp3_careers: AdvancedUnitContent = {
  unitId: "fd4a3138-8084-4749-a524-6a1503ec0f3b",
  topicLabel: "Planes y Carreras",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "la carrera", english: "career / academic major", partOfSpeech: "sustantivo", example: "Eligió la carrera de medicina porque quiere ayudar a los demás.", exampleTranslation: "She chose the medicine career because she wants to help others." },
    { spanish: "el empleo", english: "employment / job", partOfSpeech: "sustantivo", example: "Encontrar empleo después de graduarse puede ser difícil.", exampleTranslation: "Finding employment after graduating can be difficult." },
    { spanish: "la solicitud", english: "application / request", partOfSpeech: "sustantivo", example: "Enviamos la solicitud antes de la fecha límite.", exampleTranslation: "We sent the application before the deadline." },
    { spanish: "el currículum", english: "résumé / CV", partOfSpeech: "sustantivo", example: "Es importante actualizar el currículum con regularidad.", exampleTranslation: "It is important to update the résumé regularly." },
    { spanish: "la entrevista", english: "interview", partOfSpeech: "sustantivo", example: "Practicó mucho antes de la entrevista de trabajo.", exampleTranslation: "She practiced a lot before the job interview." },
    { spanish: "la empresa", english: "company / firm", partOfSpeech: "sustantivo", example: "La empresa ofrece muy buenos beneficios a sus empleados.", exampleTranslation: "The company offers very good benefits to its employees." },
    { spanish: "el emprendedor / la emprendedora", english: "entrepreneur", partOfSpeech: "sustantivo", example: "Los emprendedores jóvenes están cambiando la economía.", exampleTranslation: "Young entrepreneurs are changing the economy." },
    { spanish: "la habilidad", english: "skill / ability", partOfSpeech: "sustantivo", example: "La comunicación es una habilidad esencial en cualquier trabajo.", exampleTranslation: "Communication is an essential skill in any job." },
    { spanish: "establecerse", english: "to establish oneself", partOfSpeech: "verbo", example: "Quiere establecerse como diseñadora independiente.", exampleTranslation: "She wants to establish herself as an independent designer." },
    { spanish: "aspirar", english: "to aspire", partOfSpeech: "verbo", example: "Muchos jóvenes aspiran a trabajar en tecnología.", exampleTranslation: "Many young people aspire to work in technology." },
  ],
  reading: {
    title: "El emprendimiento juvenil en América Latina",
    sourceType: "noticias",
    body:
      "En los últimos años, el emprendimiento juvenil ha crecido de manera notable en América Latina. Según datos del Banco Interamericano de Desarrollo, más del 20% de los jóvenes entre 18 y 29 años han creado o intentado crear su propio negocio. Ciudades como Medellín, Buenos Aires y Ciudad de México se han convertido en centros de innovación y tecnología, atrayendo a jóvenes talentos de toda la región.\n\n\"Nuestros jóvenes tienen la creatividad y el deseo de cambiar el mundo\", dijo una experta en educación durante una cumbre reciente. \"Solo necesitan las herramientas y el apoyo adecuados.\"\n\nEntre los sectores con mayor crecimiento se encuentran la tecnología educativa, el comercio electrónico y las energías limpias. El desafío principal sigue siendo el acceso al capital inicial y la falta de redes de mentores especializados.",
  },
  culturalNote: {
    heading: "La familia y el trabajo en la cultura hispana",
    body:
      "En muchas culturas hispanas, la familia juega un papel central en las decisiones profesionales. No es poco común que los jóvenes busquen el consejo —y la aprobación— de sus padres antes de elegir una carrera universitaria o aceptar un trabajo en otra ciudad. Este vínculo familiar fuerte puede ser una fuente de apoyo invaluable, pero también puede crear tensiones cuando las aspiraciones individuales difieren de las expectativas familiares.\n\nAl mismo tiempo, la generación más joven está transformando estas normas: cada vez más jóvenes latinoamericanos eligen estudiar en el extranjero, fundar sus propias empresas digitales o trabajar de forma remota para empresas internacionales. El equilibrio entre la tradición familiar y las ambiciones individuales es un tema central en la vida de muchos jóvenes hispanos hoy.",
  },
};

const sp3_skills: AdvancedUnitContent = {
  unitId: "4f0f87c2-1dc2-4a2b-a771-a84547dbd28c",
  topicLabel: "Expresión y Debate",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "argumentar", english: "to argue / to make a case", partOfSpeech: "verbo", example: "Es importante argumentar con evidencias claras.", exampleTranslation: "It is important to argue with clear evidence." },
    { spanish: "resumir", english: "to summarize", partOfSpeech: "verbo", example: "¿Puede resumir los puntos principales del artículo?", exampleTranslation: "Can you summarize the main points of the article?" },
    { spanish: "contrastar", english: "to contrast", partOfSpeech: "verbo", example: "El autor contrasta dos épocas históricas diferentes.", exampleTranslation: "The author contrasts two different historical periods." },
    { spanish: "evaluar", english: "to evaluate", partOfSpeech: "verbo", example: "Es necesario evaluar todas las opciones antes de decidir.", exampleTranslation: "It is necessary to evaluate all options before deciding." },
    { spanish: "reflexionar", english: "to reflect", partOfSpeech: "verbo", example: "Reflexionar sobre nuestras acciones nos ayuda a crecer.", exampleTranslation: "Reflecting on our actions helps us grow." },
    { spanish: "sin embargo", english: "however", partOfSpeech: "frase", example: "Es una buena idea; sin embargo, tiene algunos problemas.", exampleTranslation: "It is a good idea; however, it has some problems." },
    { spanish: "por otro lado", english: "on the other hand", partOfSpeech: "frase", example: "Por otro lado, hay quienes no están de acuerdo.", exampleTranslation: "On the other hand, there are those who disagree." },
    { spanish: "en consecuencia", english: "as a result / consequently", partOfSpeech: "frase", example: "No estudió. En consecuencia, no superó el examen.", exampleTranslation: "He didn't study. As a result, he didn't pass the exam." },
    { spanish: "cabe destacar", english: "it is worth noting", partOfSpeech: "frase", example: "Cabe destacar que este problema no es nuevo.", exampleTranslation: "It is worth noting that this problem is not new." },
    { spanish: "en definitiva", english: "in short / ultimately", partOfSpeech: "frase", example: "En definitiva, la solución depende de nosotros.", exampleTranslation: "In short, the solution depends on us." },
  ],
  reading: {
    title: "El valor del intercambio cultural",
    sourceType: "ensayo",
    body:
      "El intercambio cultural es uno de los fenómenos más enriquecedores de nuestro tiempo. Cuando personas de diferentes culturas se encuentran, aprenden no solo palabras nuevas, sino formas distintas de ver el mundo. Sin embargo, no siempre es un proceso sencillo. La diferencia de valores, costumbres y expectativas puede generar malentendidos.\n\nPor otro lado, es precisamente en esos momentos de incomprensión donde surge la oportunidad de crecer. Cabe destacar que el verdadero aprendizaje intercultural no ocurre en el aula, sino en la vida cotidiana: en una conversación en la calle, en una comida compartida, en la búsqueda de palabras para explicar algo que en la propia lengua parece evidente.\n\nEn definitiva, el aprendizaje de una lengua es siempre, también, un aprendizaje humano.",
  },
  culturalNote: {
    heading: "Comunicarse en el mundo hispano",
    body:
      "En el mundo hispanohablante, la comunicación tiende a ser más cálida y contextual que en muchas culturas del norte de Europa o de Norteamérica. El contacto visual, el tono de voz y el lenguaje corporal son tan importantes como las palabras mismas. Las conversaciones a menudo incluyen temas personales —la familia, la salud, las emociones— incluso en contextos profesionales, no por falta de formalidad, sino porque en la cultura hispana las relaciones personales son la base de la confianza.\n\nEl uso del tuteo (hablar de 'tú' a 'tú') es frecuente incluso en situaciones que en otros contextos serían más formales. En España, por ejemplo, es habitual que un estudiante llame a su profesor por el nombre de pila. Aprender a calibrar estos niveles de formalidad —y disfrutar de la calidez que los caracteriza— es una parte esencial del dominio real del español.",
  },
};

const sp3_tech: AdvancedUnitContent = {
  unitId: "8bc76af4-2e5e-4cf2-b75f-6404cc177ee6",
  topicLabel: "Tecnología y Sociedad",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "la red social", english: "social network", partOfSpeech: "sustantivo", example: "Las redes sociales han cambiado la forma de comunicarnos.", exampleTranslation: "Social networks have changed the way we communicate." },
    { spanish: "la inteligencia artificial", english: "artificial intelligence", partOfSpeech: "sustantivo", example: "La inteligencia artificial está transformando muchas industrias.", exampleTranslation: "Artificial intelligence is transforming many industries." },
    { spanish: "la privacidad", english: "privacy", partOfSpeech: "sustantivo", example: "Proteger la privacidad en internet es cada vez más difícil.", exampleTranslation: "Protecting privacy online is increasingly difficult." },
    { spanish: "la contraseña", english: "password", partOfSpeech: "sustantivo", example: "Use siempre una contraseña segura y única.", exampleTranslation: "Always use a secure and unique password." },
    { spanish: "el usuario / la usuaria", english: "user", partOfSpeech: "sustantivo", example: "Hay más de dos mil millones de usuarios en esta plataforma.", exampleTranslation: "There are more than two billion users on this platform." },
    { spanish: "los datos", english: "data", partOfSpeech: "sustantivo", example: "Las empresas recopilan datos sobre el comportamiento de sus usuarios.", exampleTranslation: "Companies collect data on their users' behavior." },
    { spanish: "la aplicación", english: "app / application", partOfSpeech: "sustantivo", example: "Descargué una aplicación para aprender vocabulario.", exampleTranslation: "I downloaded an app to learn vocabulary." },
    { spanish: "conectarse", english: "to connect / to log in", partOfSpeech: "verbo", example: "Me conecto a internet todos los días para trabajar.", exampleTranslation: "I connect to the internet every day for work." },
    { spanish: "actualizar", english: "to update", partOfSpeech: "verbo", example: "Es importante actualizar el software con regularidad.", exampleTranslation: "It is important to update the software regularly." },
    { spanish: "la brecha digital", english: "digital divide", partOfSpeech: "sustantivo", example: "La brecha digital afecta especialmente a las zonas rurales.", exampleTranslation: "The digital divide especially affects rural areas." },
  ],
  reading: {
    title: "La revolución digital en América Latina",
    sourceType: "noticias",
    body:
      "América Latina es hoy una de las regiones con mayor crecimiento en el uso de internet y redes sociales. Con más de 400 millones de usuarios activos en plataformas como Instagram, TikTok y WhatsApp, la región está transformando su economía y su cultura digital.\n\nSin embargo, la llamada 'brecha digital' sigue siendo un problema urgente: millones de personas en zonas rurales no tienen acceso a internet de alta velocidad ni a dispositivos modernos. En Bolivia, por ejemplo, menos del 45% de la población tiene acceso a internet en casa.\n\nOrganizaciones públicas y privadas trabajan para llevar conectividad a comunidades remotas, reconociendo que en el siglo XXI el acceso a la tecnología es un derecho fundamental, tan importante como el acceso al agua o a la educación.",
  },
  culturalNote: {
    heading: "WhatsApp, TikTok y la identidad digital hispana",
    body:
      "WhatsApp es, con gran diferencia, la plataforma de comunicación más popular en el mundo hispanohablante. En países como Argentina, Colombia, España y México, es la principal forma de comunicación personal y profesional, sustituyendo en muchos casos al correo electrónico e incluso a las llamadas telefónicas. Los grupos familiares de WhatsApp —a veces enormes, con decenas de miembros— son parte integral de la vida cotidiana.\n\nTikTok, por su parte, ha dado a los jóvenes hispanohablantes una plataforma global para expresar su creatividad en su propio idioma. Creadores de contenido en español acumulan millones de seguidores en todo el mundo, y el español se ha convertido en la segunda lengua más usada en la plataforma.\n\nLa industria tecnológica latinoamericana también produce sus propios gigantes: MercadoLibre (Argentina), Nubank (Brasil) y Rappi (Colombia) demuestran que la innovación digital en la región va mucho más allá de imitar modelos de Silicon Valley.",
  },
};

const sp3_travel: AdvancedUnitContent = {
  unitId: "1b52fca7-a220-408b-a894-37dd0e8615cf",
  topicLabel: "Viajes y Exploración",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "el itinerario", english: "itinerary", partOfSpeech: "sustantivo", example: "El itinerario incluye tres ciudades en diez días.", exampleTranslation: "The itinerary includes three cities in ten days." },
    { spanish: "el equipaje", english: "luggage", partOfSpeech: "sustantivo", example: "Facturé el equipaje en el aeropuerto.", exampleTranslation: "I checked my luggage at the airport." },
    { spanish: "la aduana", english: "customs", partOfSpeech: "sustantivo", example: "En la aduana revisaron todas nuestras maletas.", exampleTranslation: "At customs they checked all our bags." },
    { spanish: "el alojamiento", english: "accommodation / lodging", partOfSpeech: "sustantivo", example: "Reservamos el alojamiento con tres meses de anticipación.", exampleTranslation: "We booked the accommodation three months in advance." },
    { spanish: "el trayecto", english: "journey / route", partOfSpeech: "sustantivo", example: "El trayecto en tren dura cuatro horas.", exampleTranslation: "The train journey takes four hours." },
    { spanish: "el turismo", english: "tourism", partOfSpeech: "sustantivo", example: "El turismo es una fuente importante de ingresos para el país.", exampleTranslation: "Tourism is an important source of income for the country." },
    { spanish: "la escala", english: "layover / stopover", partOfSpeech: "sustantivo", example: "El vuelo tiene una escala de dos horas en Bogotá.", exampleTranslation: "The flight has a two-hour layover in Bogotá." },
    { spanish: "recorrer", english: "to travel through / to cover", partOfSpeech: "verbo", example: "Recorrimos todo el sur de España en dos semanas.", exampleTranslation: "We traveled through all of southern Spain in two weeks." },
    { spanish: "hospedarse", english: "to stay (at a place)", partOfSpeech: "verbo", example: "Nos hospedamos en una casa rural en los Andes.", exampleTranslation: "We stayed at a rural house in the Andes." },
    { spanish: "maravillarse", english: "to marvel / to be amazed", partOfSpeech: "verbo", example: "Me maravillé al ver el amanecer sobre Machu Picchu.", exampleTranslation: "I marveled at seeing the sunrise over Machu Picchu." },
  ],
  reading: {
    title: "La Patagonia: el sur del sur",
    sourceType: "cultural",
    body:
      "Al sur del sur, donde el continente americano se adelgaza antes de disolverse en el viento y el mar, se extiende la Patagonia. Esta región compartida entre Argentina y Chile es uno de los paisajes más salvajes y hermosos del planeta.\n\nSus glaciares azules, sus bosques de araucaria y sus pampas infinitas atraen a viajeros de todo el mundo que buscan algo más que un destino turístico convencional. Recorrer la Carretera Austral en Chile o caminar por el Parque Nacional Torres del Paine es, para muchos, una experiencia que cambia la forma de ver la vida.\n\nEl viento patagónico es protagonista: sopla con una fuerza que parece querer recordarle al visitante que en este lugar, la naturaleza manda. Quien llega a la Patagonia, rara vez se va igual.",
  },
  culturalNote: {
    heading: "El turismo con conciencia en el mundo hispano",
    body:
      "El mundo hispanohablante ofrece una variedad extraordinaria de destinos: desde las ruinas de Machu Picchu en Perú hasta las playas del Caribe mexicano, desde la vibrante Buenos Aires hasta la misteriosa Isla de Pascua, desde la Alhambra de Granada hasta el volcán Arenal en Costa Rica.\n\nEl turismo cultural y el ecoturismo son tendencias crecientes: muchos viajeros buscan conectar con las comunidades locales, aprender sobre las tradiciones indígenas y contribuir a la conservación del medio ambiente. Costa Rica es considerado un modelo mundial de ecoturismo sostenible, protegiendo más del 25% de su territorio en parques y reservas naturales.\n\nViajar con respeto por las culturas y los ecosistemas locales —lo que se conoce como turismo responsable— es hoy una elección consciente y ética que cada vez más viajeros adoptan.",
  },
};

const sp3_health: AdvancedUnitContent = {
  unitId: "d20578ad-d986-462d-8d4f-7e9b34f18ecd",
  topicLabel: "Salud y Bienestar",
  levelBadge: "B1–B2",
  vocabulary: [
    { spanish: "el bienestar", english: "well-being / wellness", partOfSpeech: "sustantivo", example: "El bienestar emocional es tan importante como el físico.", exampleTranslation: "Emotional well-being is just as important as physical health." },
    { spanish: "la nutrición", english: "nutrition", partOfSpeech: "sustantivo", example: "Una buena nutrición es la base de una vida saludable.", exampleTranslation: "Good nutrition is the foundation of a healthy life." },
    { spanish: "la prevención", english: "prevention", partOfSpeech: "sustantivo", example: "La prevención es más eficaz que el tratamiento.", exampleTranslation: "Prevention is more effective than treatment." },
    { spanish: "el hábito", english: "habit", partOfSpeech: "sustantivo", example: "Dormir ocho horas es un hábito muy saludable.", exampleTranslation: "Sleeping eight hours is a very healthy habit." },
    { spanish: "el tratamiento", english: "treatment", partOfSpeech: "sustantivo", example: "El médico recomendó un tratamiento de seis semanas.", exampleTranslation: "The doctor recommended a six-week treatment." },
    { spanish: "el equilibrio", english: "balance", partOfSpeech: "sustantivo", example: "Es importante encontrar el equilibrio entre el trabajo y el descanso.", exampleTranslation: "It is important to find balance between work and rest." },
    { spanish: "la ansiedad", english: "anxiety", partOfSpeech: "sustantivo", example: "Muchos jóvenes sufren ansiedad por la presión académica.", exampleTranslation: "Many young people suffer anxiety due to academic pressure." },
    { spanish: "la meditación", english: "meditation", partOfSpeech: "sustantivo", example: "Practico la meditación cada mañana para comenzar bien el día.", exampleTranslation: "I practice meditation every morning to start the day well." },
    { spanish: "cuidarse", english: "to take care of oneself", partOfSpeech: "verbo", example: "Es fundamental cuidarse tanto física como emocionalmente.", exampleTranslation: "It is fundamental to take care of oneself both physically and emotionally." },
    { spanish: "sanar", english: "to heal", partOfSpeech: "verbo", example: "El cuerpo tiene una capacidad natural de sanar.", exampleTranslation: "The body has a natural ability to heal." },
  ],
  reading: {
    title: "La medicina tradicional y la ciencia moderna",
    sourceType: "cultural",
    body:
      "En muchas comunidades indígenas de América Latina, la medicina tradicional y la medicina moderna coexisten de manera complementaria. Las plantas medicinales —la coca en los Andes, la valeriana en México, el aloe vera en toda la región— han sido usadas durante siglos para tratar enfermedades y promover el bienestar.\n\nHoy, investigadores de universidades latinoamericanas estudian estas plantas para comprender sus propiedades desde una perspectiva científica. Los resultados son prometedores: muchas plantas que los curanderos conocían desde hace generaciones han demostrado tener compuestos activos con propiedades antiinflamatorias, analgésicas o antimicrobianas.\n\nPara muchas personas en América Latina, el curanderismo —la práctica de curar a través del conocimiento ancestral— no está en conflicto con la medicina occidental. Ambas tradiciones conviven, se complementan y, juntas, ofrecen una visión más completa del ser humano.",
  },
  culturalNote: {
    heading: "El bienestar en la cultura hispana: cuerpo, familia y alma",
    body:
      "En el mundo hispano, el concepto de salud va mucho más allá del bienestar físico. La salud emocional, la salud familiar y la salud espiritual son consideradas igual de importantes. Compartir una comida larga en casa, conversar con la familia, visitar a los amigos —estos actos cotidianos son también actos de cuidado y de amor.\n\nLa siesta —aunque hoy menos común en las ciudades— refleja una filosofía de vida que valora el descanso como parte activa del bienestar, no como una señal de pereza. En España, la sobremesa —la conversación tranquila que se extiende después de comer— es un ritual social que muy pocas culturas del mundo preservan con tanto cuidado.\n\nLa gastronomía mediterránea española, con su énfasis en el aceite de oliva, las legumbres y el pescado, es reconocida mundialmente como uno de los patrones alimenticios más saludables. Cuidarse, en muchas culturas hispanas, es también cuidar a los que uno ama.",
  },
};

// ── Spanish 4 — Advanced Low / Mid (B2–C1) ────────────────────────────────────

const sp4_global: AdvancedUnitContent = {
  unitId: "fe2d537e-ce99-4102-9189-70446772f740",
  topicLabel: "Desafíos Globales",
  levelBadge: "B2",
  vocabulary: [
    { spanish: "el cambio climático", english: "climate change", partOfSpeech: "sustantivo", example: "El cambio climático afecta especialmente a los países más pobres.", exampleTranslation: "Climate change especially affects the poorest countries." },
    { spanish: "la sostenibilidad", english: "sustainability", partOfSpeech: "sustantivo", example: "El desarrollo sostenible equilibra el progreso y el medioambiente.", exampleTranslation: "Sustainable development balances progress and the environment." },
    { spanish: "la migración", english: "migration", partOfSpeech: "sustantivo", example: "La migración por razones económicas ha aumentado en todo el mundo.", exampleTranslation: "Migration for economic reasons has increased worldwide." },
    { spanish: "la desigualdad", english: "inequality", partOfSpeech: "sustantivo", example: "La desigualdad de ingresos es uno de los mayores problemas globales.", exampleTranslation: "Income inequality is one of the greatest global problems." },
    { spanish: "la diplomacia", english: "diplomacy", partOfSpeech: "sustantivo", example: "La diplomacia es la mejor herramienta para resolver conflictos.", exampleTranslation: "Diplomacy is the best tool for resolving conflicts." },
    { spanish: "el refugiado / la refugiada", english: "refugee", partOfSpeech: "sustantivo", example: "Millones de refugiados buscan asilo en otros países cada año.", exampleTranslation: "Millions of refugees seek asylum in other countries each year." },
    { spanish: "la pobreza", english: "poverty", partOfSpeech: "sustantivo", example: "Erradicar la pobreza extrema es el primer Objetivo de Desarrollo Sostenible.", exampleTranslation: "Eradicating extreme poverty is the first Sustainable Development Goal." },
    { spanish: "la deforestación", english: "deforestation", partOfSpeech: "sustantivo", example: "La deforestación en la Amazonía tiene consecuencias globales.", exampleTranslation: "Deforestation in the Amazon has global consequences." },
    { spanish: "comprometerse", english: "to commit oneself / to pledge", partOfSpeech: "verbo", example: "Los países se comprometieron a reducir sus emisiones de carbono.", exampleTranslation: "Countries pledged to reduce their carbon emissions." },
    { spanish: "erradicar", english: "to eradicate", partOfSpeech: "verbo", example: "La comunidad internacional trabaja para erradicar el hambre.", exampleTranslation: "The international community works to eradicate hunger." },
  ],
  reading: {
    title: "Nuestra América",
    author: "José Martí",
    year: "1891",
    sourceType: "ensayo",
    body:
      "Conocer el país y gobernarlo conforme al conocimiento es el único modo de librarlo de tiranías. La universidad europea ha de ceder a la universidad americana. La historia de América, de los incas acá, ha de enseñarse al dedillo, aunque no se enseñe la de los arcontes de Grecia. Nuestra Grecia es preferible a la Grecia que no es nuestra. Nos es más necesaria.\n\nLos políticos nacionales han de reemplazar a los políticos exóticos. Injértese en nuestras repúblicas el mundo; pero el tronco ha de ser el de nuestras repúblicas. Y calle el pedante vencido; que no hay patria en que pueda tener el hombre más orgullo que en nuestras dolorosas repúblicas americanas.",
  },
  culturalNote: {
    heading: "América Latina ante los desafíos del siglo XXI",
    body:
      "América Latina enfrenta hoy desafíos globales que requieren respuestas colectivas y solidarias. El cambio climático amenaza especialmente a países como Honduras, Bolivia y las islas del Caribe, donde las comunidades rurales dependen de ecosistemas frágiles. Al mismo tiempo, la región produce el 30% del agua dulce del planeta y alberga la Amazonía —el bosque tropical más grande del mundo y uno de los pulmones verdes del planeta.\n\nCosta Rica ha demostrado que es posible combinar el crecimiento económico con la protección ambiental: más del 99% de su electricidad proviene de fuentes renovables. Chile lidera en energía solar en la región. La lucha por un futuro sostenible en América Latina no es solo una cuestión ambiental: es también una cuestión de justicia social e intergeneracional.",
  },
};

const sp4_science: AdvancedUnitContent = {
  unitId: "d405bca9-f9f3-455c-9842-55044a2c1414",
  topicLabel: "Ciencia e Innovación",
  levelBadge: "B2",
  vocabulary: [
    { spanish: "la investigación", english: "research", partOfSpeech: "sustantivo", example: "La investigación científica requiere años de trabajo riguroso.", exampleTranslation: "Scientific research requires years of rigorous work." },
    { spanish: "el descubrimiento", english: "discovery", partOfSpeech: "sustantivo", example: "El descubrimiento de la penicilina salvó millones de vidas.", exampleTranslation: "The discovery of penicillin saved millions of lives." },
    { spanish: "la hipótesis", english: "hypothesis", partOfSpeech: "sustantivo", example: "El científico propuso una hipótesis y la puso a prueba.", exampleTranslation: "The scientist proposed a hypothesis and put it to the test." },
    { spanish: "la patente", english: "patent", partOfSpeech: "sustantivo", example: "Registraron la patente antes de publicar su investigación.", exampleTranslation: "They registered the patent before publishing their research." },
    { spanish: "el ecosistema", english: "ecosystem", partOfSpeech: "sustantivo", example: "La destrucción de un ecosistema puede ser irreversible.", exampleTranslation: "The destruction of an ecosystem can be irreversible." },
    { spanish: "la biodiversidad", english: "biodiversity", partOfSpeech: "sustantivo", example: "Colombia tiene una de las mayores biodiversidades del planeta.", exampleTranslation: "Colombia has one of the greatest biodiversities on the planet." },
    { spanish: "el ensayo clínico", english: "clinical trial", partOfSpeech: "frase", example: "El nuevo medicamento está en fase de ensayo clínico.", exampleTranslation: "The new drug is in the clinical trial phase." },
    { spanish: "innovar", english: "to innovate", partOfSpeech: "verbo", example: "Las startups latinoamericanas innovan en tecnología financiera.", exampleTranslation: "Latin American startups innovate in financial technology." },
    { spanish: "comprobar", english: "to verify / to confirm", partOfSpeech: "verbo", example: "Es fundamental comprobar los resultados antes de publicarlos.", exampleTranslation: "It is essential to verify results before publishing them." },
    { spanish: "el avance", english: "advance / breakthrough", partOfSpeech: "sustantivo", example: "Este avance en medicina podría cambiar el tratamiento del cáncer.", exampleTranslation: "This medical breakthrough could change cancer treatment." },
  ],
  reading: {
    title: "Científicos hispanos que cambiaron el mundo",
    sourceType: "cultural",
    body:
      "A lo largo de la historia, científicos hispanos han contribuido de manera decisiva al avance del conocimiento humano. Luis Walter Álvarez, hijo de padres de origen mexicano, ganó el Premio Nobel de Física en 1968 por sus contribuciones a la física de partículas. Severo Ochoa, nacido en España, lo recibió en Fisiología en 1959 por su trabajo sobre la síntesis del ARN.\n\nSantiago Ramón y Cajal (España, 1906) es considerado el padre de la neurociencia moderna: sus investigaciones sobre la estructura del sistema nervioso sentaron las bases de todo lo que sabemos hoy sobre el cerebro. En 2020, la chilena Andrea Ghez ganó el Nobel de Física por demostrar la existencia de un agujero negro supermasivo en el centro de nuestra galaxia.\n\nHoy, universidades como la UNAM en México y la Universidad de los Andes en Colombia producen investigación de clase mundial en biotecnología, astronomía y energías renovables.",
  },
  culturalNote: {
    heading: "La ciencia hispana: una herencia invisible",
    body:
      "La contribución del mundo hispano a la ciencia global es profunda y a menudo poco conocida fuera del mundo académico. Durante la Edad de Oro árabe-española (siglos VIII al XIII), la Península Ibérica fue el centro del conocimiento científico en Occidente: médicos, matemáticos y astrónomos árabes, judíos y cristianos convivían en ciudades como Toledo y Córdoba, traduciendo y ampliando el saber de la Antigüedad.\n\nEn América Latina, la tradición científica indígena es igualmente extraordinaria: los mayas desarrollaron un sistema astronómico de gran precisión, y los incas crearon técnicas agrícolas y de ingeniería hidráulica que siguen impresionando a los científicos modernos. Reconocer esta herencia es parte esencial de una educación científica completa.",
  },
};

const sp4_culture: AdvancedUnitContent = {
  unitId: "28ec68bf-fc04-4aa6-8d42-7bd429cc847c",
  topicLabel: "Perspectivas Culturales",
  levelBadge: "B2",
  vocabulary: [
    { spanish: "la cosmovisión", english: "worldview", partOfSpeech: "sustantivo", example: "La cosmovisión indígena valora la armonía con la naturaleza.", exampleTranslation: "The indigenous worldview values harmony with nature." },
    { spanish: "el sincretismo", english: "syncretism", partOfSpeech: "sustantivo", example: "El sincretismo religioso es visible en las fiestas populares latinoamericanas.", exampleTranslation: "Religious syncretism is visible in Latin American popular festivals." },
    { spanish: "el folclore", english: "folklore", partOfSpeech: "sustantivo", example: "El folclore refleja la identidad y la memoria de un pueblo.", exampleTranslation: "Folklore reflects the identity and memory of a people." },
    { spanish: "el ritual", english: "ritual", partOfSpeech: "sustantivo", example: "Los rituales de la Semana Santa son impresionantes en Sevilla.", exampleTranslation: "Holy Week rituals are impressive in Seville." },
    { spanish: "el símbolo", english: "symbol", partOfSpeech: "sustantivo", example: "El quetzal es el símbolo nacional de Guatemala.", exampleTranslation: "The quetzal is the national symbol of Guatemala." },
    { spanish: "el mito", english: "myth", partOfSpeech: "sustantivo", example: "Los mitos griegos y prehispánicos tienen muchas similitudes.", exampleTranslation: "Greek and pre-Hispanic myths have many similarities." },
    { spanish: "la celebración", english: "celebration", partOfSpeech: "sustantivo", example: "El Carnaval de Barranquilla es la mayor celebración de Colombia.", exampleTranslation: "The Barranquilla Carnival is Colombia's greatest celebration." },
    { spanish: "el etnocentrismo", english: "ethnocentrism", partOfSpeech: "sustantivo", example: "El etnocentrismo impide la comprensión de otras culturas.", exampleTranslation: "Ethnocentrism prevents understanding of other cultures." },
    { spanish: "el relativismo cultural", english: "cultural relativism", partOfSpeech: "frase", example: "El relativismo cultural nos invita a entender otras tradiciones en su contexto.", exampleTranslation: "Cultural relativism invites us to understand other traditions in their context." },
    { spanish: "integrar", english: "to integrate", partOfSpeech: "verbo", example: "La sociedad debe integrar a todos sus miembros con respeto.", exampleTranslation: "Society must integrate all its members with respect." },
  ],
  reading: {
    title: "El Día de los Muertos: una celebración de vida",
    sourceType: "cultural",
    body:
      "El Día de los Muertos, celebrado los días 1 y 2 de noviembre en México y otras partes de América Latina, es mucho más que una celebración folklórica. Es una expresión profunda de la cosmovisión indígena que no teme a la muerte, sino que la abraza como parte natural del ciclo de la vida.\n\nLas familias construyen altares —llamados 'ofrendas'— con flores de cempasúchil, fotografías de los difuntos, comida que les gustaba, velas y objetos personales. La idea es que ese día, los muertos regresan para estar con sus seres queridos. No es tristeza: es fiesta, es recuerdo, es amor.\n\nContrariamente a lo que muchos piensan, no es una versión latinoamericana del Halloween anglosajón. Es una tradición milenaria de raíz prehispánica que fue declarada Patrimonio Cultural Inmaterial de la Humanidad por la UNESCO en 2008.",
  },
  culturalNote: {
    heading: "El sincretismo cultural: cuando las culturas se abrazan",
    body:
      "El sincretismo es uno de los fenómenos más fascinantes del mundo hispano. Durante la colonización española, las tradiciones indígenas y africanas no fueron simplemente borradas: se mezclaron con el catolicismo y las costumbres europeas para crear algo nuevo, profundamente latinoamericano, que no es ninguna de las partes originales sino una síntesis viva.\n\nEste proceso se puede observar en la música —el son cubano mezcla ritmos africanos con melodías españolas y estructuras indígenas—, en la gastronomía —el mole mexicano combina ingredientes prehispánicos como el chile y el cacao con especias del Viejo Mundo—, y en el arte —la pintura de Frida Kahlo fusiona el folclore mexicano con el surrealismo europeo.\n\nEl sincretismo no es debilidad cultural ni pérdida de identidad. Es creatividad, resistencia y capacidad de transformar el mundo que nos llega en algo propio.",
  },
};

const sp4_ap: AdvancedUnitContent = {
  unitId: "e595c84e-8e32-4831-8ac6-f7c3111a22dd",
  topicLabel: "Preparación para el Examen AP",
  levelBadge: "B2–C1",
  vocabulary: [
    { spanish: "analizar", english: "to analyze", partOfSpeech: "verbo", example: "Es importante analizar las fuentes antes de escribir el ensayo.", exampleTranslation: "It is important to analyze the sources before writing the essay." },
    { spanish: "sintetizar", english: "to synthesize", partOfSpeech: "verbo", example: "El ensayo debe sintetizar las ideas de tres fuentes distintas.", exampleTranslation: "The essay must synthesize ideas from three different sources." },
    { spanish: "inferir", english: "to infer", partOfSpeech: "verbo", example: "A partir del texto, podemos inferir la postura del autor.", exampleTranslation: "From the text, we can infer the author's position." },
    { spanish: "deducir", english: "to deduce", partOfSpeech: "verbo", example: "Deduzca el significado de la palabra según el contexto.", exampleTranslation: "Deduce the meaning of the word from context." },
    { spanish: "la evidencia", english: "evidence", partOfSpeech: "sustantivo", example: "Use evidencia del texto para apoyar su argumento.", exampleTranslation: "Use evidence from the text to support your argument." },
    { spanish: "la fuente", english: "source", partOfSpeech: "sustantivo", example: "Evalúe la fiabilidad de cada fuente antes de usarla.", exampleTranslation: "Evaluate the reliability of each source before using it." },
    { spanish: "la perspectiva", english: "perspective", partOfSpeech: "sustantivo", example: "Compare su perspectiva cultural con la de la fuente.", exampleTranslation: "Compare your cultural perspective with that of the source." },
    { spanish: "la conclusión", english: "conclusion", partOfSpeech: "sustantivo", example: "La conclusión debe responder directamente a la pregunta inicial.", exampleTranslation: "The conclusion must directly answer the initial question." },
    { spanish: "comparar", english: "to compare", partOfSpeech: "verbo", example: "Compare las prácticas culturales de dos comunidades hispanohablantes.", exampleTranslation: "Compare the cultural practices of two Spanish-speaking communities." },
    { spanish: "el punto de vista", english: "point of view", partOfSpeech: "frase", example: "El punto de vista del narrador influye en cómo percibimos los eventos.", exampleTranslation: "The narrator's point of view influences how we perceive events." },
  ],
  reading: {
    title: "Globalización y lenguas indígenas",
    sourceType: "ensayo",
    body:
      "La globalización ha transformado profundamente las culturas del mundo hispano. Por un lado, ha facilitado el acceso a nuevas ideas, tecnologías y oportunidades económicas. Por otro lado, ha generado preocupaciones legítimas sobre la pérdida de lenguas indígenas, tradiciones locales y formas de vida ancestrales.\n\nLingüistas estiman que la mitad de las aproximadamente 6.000 lenguas que existen hoy en el mundo podrían desaparecer para el año 2100. Muchas de ellas se hablan en América Latina: el náhuatl, el quechua, el maya, el guaraní y otras decenas de lenguas indígenas están bajo presión constante.\n\nEl debate sobre cómo equilibrar el progreso económico con la preservación cultural es uno de los más urgentes de nuestro tiempo, y no admite respuestas simples. ¿Qué perdemos cuando se extingue una lengua? Se pierde una forma de nombrar el mundo que nadie volverá a recuperar.",
  },
  culturalNote: {
    heading: "El examen AP de Español: guía para el éxito",
    body:
      "El Examen AP de Español Lengua y Cultura evalúa la capacidad de los estudiantes para comunicarse en contextos académicos y culturales auténticos. Una parte central del examen es la comparación cultural: se espera que los estudiantes puedan relacionar un tema de la cultura hispanohablante con su propia comunidad de manera reflexiva y fundamentada.\n\nPara prepararse bien, es útil leer textos auténticos —noticias, blogs, ensayos literarios— y escuchar podcasts y programas en español de diferentes países y regiones. La variedad lingüística del español no es un obstáculo: entender acentos de España, México, Argentina y el Caribe amplía la comprensión y el disfrute del idioma.\n\nRecuerde que el examen no evalúa la perfección gramatical, sino la capacidad de comunicar ideas con claridad, precisión y riqueza cultural.",
  },
};

const sp4_advLow: AdvancedUnitContent = {
  unitId: "47c20b86-6f10-4c5b-b29c-4d5e6f678768",
  topicLabel: "Habilidades Avanzadas",
  levelBadge: "B2",
  vocabulary: [
    { spanish: "sin embargo", english: "however", partOfSpeech: "frase", example: "El plan parece sólido; sin embargo, tiene algunas debilidades.", exampleTranslation: "The plan seems solid; however, it has some weaknesses." },
    { spanish: "a pesar de", english: "despite", partOfSpeech: "frase", example: "A pesar de las dificultades, continuó adelante.", exampleTranslation: "Despite the difficulties, she continued forward." },
    { spanish: "no obstante", english: "nevertheless / nonetheless", partOfSpeech: "frase", example: "No obstante, hay razones para ser optimistas.", exampleTranslation: "Nevertheless, there are reasons to be optimistic." },
    { spanish: "cabe señalar", english: "it should be noted", partOfSpeech: "frase", example: "Cabe señalar que los datos son de 2022.", exampleTranslation: "It should be noted that the data is from 2022." },
    { spanish: "en cuanto a", english: "regarding / as for", partOfSpeech: "frase", example: "En cuanto a los resultados, son positivos.", exampleTranslation: "Regarding the results, they are positive." },
    { spanish: "si bien", english: "although / while it is true that", partOfSpeech: "frase", example: "Si bien la situación ha mejorado, queda mucho por hacer.", exampleTranslation: "Although the situation has improved, much remains to be done." },
    { spanish: "con respecto a", english: "with respect to / regarding", partOfSpeech: "frase", example: "Con respecto a la economía, los expertos difieren.", exampleTranslation: "With respect to the economy, experts differ." },
    { spanish: "de ahí que", english: "hence / that is why", partOfSpeech: "frase", example: "No tenía experiencia; de ahí que cometiera ese error.", exampleTranslation: "She had no experience; hence she made that mistake." },
    { spanish: "a raíz de", english: "as a result of / stemming from", partOfSpeech: "frase", example: "A raíz de la pandemia, el trabajo remoto se normalizó.", exampleTranslation: "As a result of the pandemic, remote work became normalized." },
    { spanish: "dado que", english: "given that / since", partOfSpeech: "frase", example: "Dado que el tiempo es limitado, debemos priorizar.", exampleTranslation: "Given that time is limited, we must prioritize." },
  ],
  reading: {
    title: "Ciudades latinoamericanas: vitalidad y contradicción",
    sourceType: "ensayo",
    body:
      "Las grandes ciudades latinoamericanas comparten características fascinantes y contradictorias. Ciudad de México, Buenos Aires, Lima y Bogotá son centros culturales y económicos de enorme vitalidad, pero también escenarios de profunda desigualdad social.\n\nSi bien han experimentado un crecimiento económico notable en las últimas décadas, a raíz de este crecimiento han surgido nuevos retos: tráfico caótico, segregación residencial y presión sobre los servicios públicos. No obstante, estas ciudades son también laboratorios de innovación social, donde iniciativas ciudadanas y proyectos comunitarios demuestran que es posible construir una vida urbana más justa.\n\nDado que más del 80% de la población latinoamericana vive hoy en ciudades, el futuro de la región se decidirá en sus calles, sus plazas y sus barrios.",
  },
  culturalNote: {
    heading: "La diversidad lingüística del español urbano",
    body:
      "El español urbano de América Latina está en constante evolución. Cada ciudad tiene su propio vocabulario, sus propias expresiones y su ritmo particular. En Buenos Aires se usa el 'voseo' —tratar a la persona de 'vos' en lugar de 'tú'—, una característica que distingue al español rioplatense de todos los demás. En Ciudad de México, el habla chilanga tiene un vocabulario propio lleno de ironía y creatividad. En Colombia, el español de Medellín suena muy diferente al de la Costa Atlántica.\n\nEsta diversidad lingüística es una de las grandes riquezas del español. A pesar de las diferencias regionales —que pueden ser considerables—, los hablantes de todo el mundo hispanohablante se entienden perfectamente. Cada variedad aporta algo único: nuevo vocabulario, nuevas metáforas, nuevas formas de ver el mundo.",
  },
};

const sp4_advMid: AdvancedUnitContent = {
  unitId: "27b8b9e1-27aa-4d8f-9e30-4f1e692514d7",
  topicLabel: "Análisis y Expresión Avanzados",
  levelBadge: "B2–C1",
  vocabulary: [
    { spanish: "el paradigma", english: "paradigm", partOfSpeech: "sustantivo", example: "La revolución científica cambió el paradigma del universo.", exampleTranslation: "The scientific revolution changed the paradigm of the universe." },
    { spanish: "la ambigüedad", english: "ambiguity", partOfSpeech: "sustantivo", example: "La ambigüedad del poema permite múltiples interpretaciones.", exampleTranslation: "The ambiguity of the poem allows for multiple interpretations." },
    { spanish: "la retórica", english: "rhetoric", partOfSpeech: "sustantivo", example: "El político usó una retórica muy efectiva en su discurso.", exampleTranslation: "The politician used very effective rhetoric in his speech." },
    { spanish: "el discurso", english: "discourse / speech", partOfSpeech: "sustantivo", example: "El discurso político refleja los valores de una sociedad.", exampleTranslation: "Political discourse reflects the values of a society." },
    { spanish: "la connotación", english: "connotation", partOfSpeech: "sustantivo", example: "La palabra 'hogar' tiene connotaciones cálidas y positivas.", exampleTranslation: "The word 'home' has warm and positive connotations." },
    { spanish: "matizar", english: "to nuance / to qualify", partOfSpeech: "verbo", example: "El autor matiza su postura en el último capítulo.", exampleTranslation: "The author nuances his position in the last chapter." },
    { spanish: "cuestionar", english: "to question / to challenge", partOfSpeech: "verbo", example: "El ensayo cuestiona los supuestos de la economía clásica.", exampleTranslation: "The essay questions the assumptions of classical economics." },
    { spanish: "profundizar", english: "to deepen / to explore in depth", partOfSpeech: "verbo", example: "Este libro profundiza en las causas de la Revolución Mexicana.", exampleTranslation: "This book explores in depth the causes of the Mexican Revolution." },
    { spanish: "subyacer", english: "to underlie", partOfSpeech: "verbo", example: "Bajo la aparente calma, subyace una tensión profunda.", exampleTranslation: "Beneath the apparent calm, a deep tension underlies." },
    { spanish: "la denotación", english: "denotation", partOfSpeech: "sustantivo", example: "La denotación de una palabra es su significado literal.", exampleTranslation: "The denotation of a word is its literal meaning." },
  ],
  reading: {
    title: "El realismo mágico: una forma de ver el mundo",
    sourceType: "ensayo",
    body:
      "El realismo mágico es, quizás, la aportación más reconocida de América Latina a la literatura universal. En obras como 'Cien años de soledad' de García Márquez o 'La casa de los espíritus' de Isabel Allende, lo sobrenatural se integra en la realidad cotidiana de manera tan natural que el lector no cuestiona su presencia: simplemente la acepta, como se acepta el sol o la lluvia.\n\nEsta técnica narrativa no es un simple truco literario. Refleja una cosmovisión en la que lo visible y lo invisible, lo racional y lo mítico, coexisten sin contradicción. Más que un estilo, el realismo mágico es una forma de ver el mundo que hunde sus raíces en las tradiciones indígenas y africanas de la región, donde la frontera entre los vivos y los muertos, entre el sueño y la realidad, siempre fue más porosa que en la tradición europea.\n\nLeer realismo mágico es aprender a ver de otra manera.",
  },
  culturalNote: {
    heading: "Los Nobel de Literatura en español",
    body:
      "El Premio Nobel de Literatura ha reconocido a numerosos escritores en lengua española a lo largo del siglo XX y XXI: Jacinto Benavente (España, 1922), Gabriela Mistral (Chile, 1945, la primera latinoamericana y primera mujer hispanohablante en ganar el Nobel), Juan Ramón Jiménez (España, 1956), Miguel Ángel Asturias (Guatemala, 1967), Pablo Neruda (Chile, 1971), Gabriel García Márquez (Colombia, 1982), Camilo José Cela (España, 1989), Octavio Paz (México, 1990) y Mario Vargas Llosa (Perú, 2010).\n\nEsta lista extraordinaria muestra que la literatura en español es una de las más ricas y diversas del mundo. Cada uno de estos autores construyó un universo literario propio, profundamente enraizado en su cultura y su momento histórico, y al mismo tiempo universal en su capacidad de hablar a lectores de todo el planeta.",
  },
};

const sp4_business: AdvancedUnitContent = {
  unitId: "2dcfa9e2-8137-4c27-8001-45740c670729",
  topicLabel: "Negocios y Vida Profesional",
  levelBadge: "B2–C1",
  vocabulary: [
    { spanish: "la negociación", english: "negotiation", partOfSpeech: "sustantivo", example: "La negociación del contrato duró tres semanas.", exampleTranslation: "The contract negotiation lasted three weeks." },
    { spanish: "la inversión", english: "investment", partOfSpeech: "sustantivo", example: "La inversión en educación es la más rentable a largo plazo.", exampleTranslation: "Investment in education is the most profitable in the long run." },
    { spanish: "el mercado", english: "market", partOfSpeech: "sustantivo", example: "El mercado latinoamericano ofrece grandes oportunidades.", exampleTranslation: "The Latin American market offers great opportunities." },
    { spanish: "el contrato", english: "contract", partOfSpeech: "sustantivo", example: "Firmaron el contrato después de una semana de negociaciones.", exampleTranslation: "They signed the contract after a week of negotiations." },
    { spanish: "la rentabilidad", english: "profitability / return on investment", partOfSpeech: "sustantivo", example: "La rentabilidad del proyecto superó las expectativas.", exampleTranslation: "The project's profitability exceeded expectations." },
    { spanish: "la estrategia", english: "strategy", partOfSpeech: "sustantivo", example: "Desarrollaron una estrategia de expansión regional.", exampleTranslation: "They developed a regional expansion strategy." },
    { spanish: "el proveedor / la proveedora", english: "supplier / vendor", partOfSpeech: "sustantivo", example: "Buscamos un proveedor local para reducir costos de envío.", exampleTranslation: "We are looking for a local supplier to reduce shipping costs." },
    { spanish: "el presupuesto", english: "budget", partOfSpeech: "sustantivo", example: "El presupuesto del proyecto es de dos millones de euros.", exampleTranslation: "The project budget is two million euros." },
    { spanish: "emprender", english: "to undertake / to start (a business)", partOfSpeech: "verbo", example: "Decidió emprender un negocio de comercio electrónico.", exampleTranslation: "She decided to start an e-commerce business." },
    { spanish: "liderar", english: "to lead", partOfSpeech: "verbo", example: "Lideró el equipo durante la crisis con gran serenidad.", exampleTranslation: "He led the team through the crisis with great composure." },
  ],
  reading: {
    title: "El auge de los mercados digitales en América Latina",
    sourceType: "noticias",
    body:
      "América Latina es hoy un mercado de más de 650 millones de personas, con una clase media creciente y un apetito enorme por la innovación digital. Sectores como el fintech, el comercio electrónico y las energías renovables están experimentando un crecimiento exponencial que atrae a inversores de todo el mundo.\n\nEmpresas como Nubank (Brasil), Clip (México) y Rappi (Colombia) han captado miles de millones de dólares en inversión internacional y han demostrado que la región puede producir empresas tecnológicas de talla global. Solo Nubank, el banco digital más grande del mundo fuera de Asia, tiene más de 80 millones de clientes.\n\nSin embargo, hacer negocios en América Latina requiere comprender sus particularidades: la importancia de las relaciones personales, el papel de la familia en las empresas, y la enorme diversidad cultural y regulatoria entre países.",
  },
  culturalNote: {
    heading: "Las relaciones personales en los negocios hispanos",
    body:
      "En el mundo de los negocios en España y América Latina, las relaciones personales son el fundamento de todo. A diferencia de culturas donde el contrato viene primero y la relación después, en el mundo hispano la confianza personal precede frecuentemente al acuerdo formal.\n\nUna reunión de negocios puede comenzar con preguntas sobre la familia, el viaje o incluso el partido de fútbol del fin de semana. Esto no es pérdida de tiempo ni falta de profesionalismo: es el proceso de construir la confianza que hará que el negocio funcione a largo plazo.\n\nEl concepto de 'compadrazgo' —las redes de lealtad personal y familiar— sigue siendo relevante en muchos contextos empresariales latinoamericanos. Entender estos códigos culturales es tan importante como conocer las cifras del mercado.",
  },
};

const sp4_arts: AdvancedUnitContent = {
  unitId: "8e7623bb-b545-4269-b0be-2d1297f812ec",
  topicLabel: "Arte, Cine y Música",
  levelBadge: "B2–C1",
  vocabulary: [
    { spanish: "el guión", english: "screenplay / script", partOfSpeech: "sustantivo", example: "El guión tardó tres años en escribirse.", exampleTranslation: "The screenplay took three years to write." },
    { spanish: "la actuación", english: "performance / acting", partOfSpeech: "sustantivo", example: "La actuación de la protagonista fue extraordinaria.", exampleTranslation: "The protagonist's performance was extraordinary." },
    { spanish: "la banda sonora", english: "soundtrack", partOfSpeech: "sustantivo", example: "La banda sonora de la película ganó un premio Óscar.", exampleTranslation: "The film's soundtrack won an Oscar." },
    { spanish: "el estreno", english: "premiere / debut release", partOfSpeech: "sustantivo", example: "El estreno mundial fue en el Festival de Cannes.", exampleTranslation: "The world premiere was at the Cannes Film Festival." },
    { spanish: "el festival", english: "festival", partOfSpeech: "sustantivo", example: "El Festival de Cine de San Sebastián es uno de los más prestigiosos.", exampleTranslation: "The San Sebastián Film Festival is one of the most prestigious." },
    { spanish: "el género musical", english: "musical genre", partOfSpeech: "frase", example: "El reggaetón es el género musical más escuchado en el mundo.", exampleTranslation: "Reggaeton is the most listened-to musical genre in the world." },
    { spanish: "componer", english: "to compose", partOfSpeech: "verbo", example: "Compuso su primera sinfonía a los dieciséis años.", exampleTranslation: "He composed his first symphony at sixteen." },
    { spanish: "interpretar", english: "to perform / to interpret", partOfSpeech: "verbo", example: "Interpretó el papel del villano con una intensidad increíble.", exampleTranslation: "She played the villain's role with incredible intensity." },
    { spanish: "la premiación", english: "awards ceremony", partOfSpeech: "sustantivo", example: "La premiación de los Goya reúne a toda la industria del cine español.", exampleTranslation: "The Goya awards ceremony brings together the entire Spanish film industry." },
    { spanish: "el ritmo", english: "rhythm / beat", partOfSpeech: "sustantivo", example: "El ritmo de la cumbia es imposible de resistir.", exampleTranslation: "The rhythm of cumbia is impossible to resist." },
  ],
  reading: {
    title: "El cine y la música hispana conquistan el mundo",
    sourceType: "cultural",
    body:
      "El cine latinoamericano ha conquistado los festivales más prestigiosos del mundo. Directores como Alfonso Cuarón y Guillermo del Toro (México) y Alejandro González Iñárritu han ganado Óscares al mejor director —una hazaña sin precedentes para una misma región—, demostrando que la visión latinoamericana puede resonar de forma universal.\n\nEn música, el fenómeno no es menos impresionante. El reggaetón —nacido en Puerto Rico a principios de los 2000— se ha convertido en el género musical más escuchado en el mundo, con artistas como Bad Bunny, J Balvin y Rosalía dominando las listas globales. El español se ha convertido en el idioma más presente en las plataformas de streaming de música después del inglés.\n\nEl flamenco español, el tango argentino, la cumbia colombiana y la salsa neoyorquina de raíces caribeñas son también tesoros culturales reconocidos y celebrados en todo el planeta.",
  },
  culturalNote: {
    heading: "El flamenco y el tango: patrimonio del alma",
    body:
      "El flamenco es mucho más que un baile: es un arte que expresa la profundidad del alma andaluza, integrando música, canto —el 'cante jondo'—, baile y poesía en una experiencia única e irrepetible. Declarado Patrimonio Cultural Inmaterial de la Humanidad por la UNESCO en 2010, el flamenco nació de la fusión extraordinaria de tradiciones gitanas, árabes, judías y castellanas en el sur de España.\n\nEl tango argentino —también Patrimonio UNESCO desde 2009— es una conversación silenciosa entre dos personas: un diálogo de movimientos que expresa amor, nostalgia, pasión y pérdida. Nació en los arrabales de Buenos Aires a finales del siglo XIX, entre inmigrantes europeos y criollos, y se convirtió en el símbolo musical de Argentina para el mundo.\n\nAmbos son ejemplos perfectos de cómo la música puede convertirse en una forma de identidad cultural, una lengua sin palabras que el mundo entero comprende.",
  },
};

// ── Spanish 5 — Advanced High (C1) ────────────────────────────────────────────

const sp5_advHigh: AdvancedUnitContent = {
  unitId: "11b3bcc3-a19f-4040-a80d-46bc634aaad7",
  topicLabel: "Dominio Avanzado",
  levelBadge: "C1",
  vocabulary: [
    { spanish: "el pensamiento crítico", english: "critical thinking", partOfSpeech: "frase", example: "El pensamiento crítico es esencial en la educación universitaria.", exampleTranslation: "Critical thinking is essential in university education." },
    { spanish: "el postcolonialismo", english: "postcolonialism", partOfSpeech: "sustantivo", example: "El postcolonialismo analiza las secuelas del colonialismo europeo.", exampleTranslation: "Postcolonialism analyzes the aftermath of European colonialism." },
    { spanish: "la hegemonía", english: "hegemony", partOfSpeech: "sustantivo", example: "La hegemonía cultural del inglés es un fenómeno global.", exampleTranslation: "The cultural hegemony of English is a global phenomenon." },
    { spanish: "dilucidar", english: "to elucidate / to clarify", partOfSpeech: "verbo", example: "El ensayo intenta dilucidar las causas del conflicto.", exampleTranslation: "The essay attempts to elucidate the causes of the conflict." },
    { spanish: "trascender", english: "to transcend", partOfSpeech: "verbo", example: "La obra de García Márquez trasciende fronteras culturales.", exampleTranslation: "García Márquez's work transcends cultural boundaries." },
    { spanish: "la dialéctica", english: "dialectic", partOfSpeech: "sustantivo", example: "La dialéctica hegeliana influyó en el pensamiento marxista.", exampleTranslation: "Hegelian dialectic influenced Marxist thought." },
    { spanish: "el imaginario colectivo", english: "collective imagination / imaginary", partOfSpeech: "frase", example: "El Quijote forma parte del imaginario colectivo español.", exampleTranslation: "Don Quijote is part of the Spanish collective imagination." },
    { spanish: "articular", english: "to articulate", partOfSpeech: "verbo", example: "El filósofo articula su argumento con gran precisión.", exampleTranslation: "The philosopher articulates his argument with great precision." },
    { spanish: "la epistemología", english: "epistemology", partOfSpeech: "sustantivo", example: "La epistemología estudia el origen y los límites del conocimiento.", exampleTranslation: "Epistemology studies the origin and limits of knowledge." },
    { spanish: "la semiótica", english: "semiotics", partOfSpeech: "sustantivo", example: "La semiótica analiza los signos y su significado en la cultura.", exampleTranslation: "Semiotics analyzes signs and their meaning in culture." },
  ],
  reading: {
    title: "La lengua como territorio",
    sourceType: "ensayo",
    body:
      "La lengua no es simplemente un instrumento de comunicación: es la casa del ser, el territorio más íntimo de la memoria y la identidad. Para un hablante que vive entre dos lenguas y dos culturas, la pregunta '¿en qué idioma sueña?' no es trivial.\n\nEl escritor cubano Guillermo Cabrera Infante dijo que su decisión de escribir en español —y no en inglés, la lengua del país que lo acogió— fue un acto de resistencia y de amor. La lengua materna no se elige: se hereda, se moldea, se pierde, se reinventa. Y al reinventarla, el escritor se reinventa a sí mismo.\n\nEstá también la lengua del poder: aquella que se impuso sobre otras, que borró nombres de lugares y silenció idiomas enteros. Recuperar una lengua indígena no es solo un acto lingüístico: es un acto político, un acto de memoria, un acto de resistencia contra el olvido.",
  },
  culturalNote: {
    heading: "El español en el mundo: segunda lengua global",
    body:
      "El español es la segunda lengua más hablada del mundo en términos de hablantes nativos —más de 485 millones— y el segundo idioma más estudiado como lengua extranjera después del inglés. Se habla en 21 países como lengua oficial y es la lengua extranjera más estudiada en los Estados Unidos, donde viven más de 40 millones de hablantes de herencia hispana.\n\nSin embargo, el español no es una lengua uniforme: es un mosaico de dialectos, acentos, vocabularios y expresiones que varían entre países, regiones y clases sociales. Esta diversidad es a la vez su mayor complejidad y su mayor riqueza. El Instituto Cervantes, con sede en Madrid y más de 90 centros en todo el mundo, trabaja para promover el español y las culturas hispanas a nivel global.\n\nAprender español a nivel avanzado no es solo dominar una gramática: es habitar un mundo.",
  },
};

const sp5_finance: AdvancedUnitContent = {
  unitId: "b07c76fe-cce2-46ff-9bda-67adee4ccd6d",
  topicLabel: "Economía y Finanzas",
  levelBadge: "C1",
  vocabulary: [
    { spanish: "la inflación", english: "inflation", partOfSpeech: "sustantivo", example: "La inflación elevada erosiona el poder adquisitivo de las familias.", exampleTranslation: "High inflation erodes the purchasing power of families." },
    { spanish: "el tipo de cambio", english: "exchange rate", partOfSpeech: "frase", example: "El tipo de cambio del peso mexicano fluctúa diariamente.", exampleTranslation: "The Mexican peso exchange rate fluctuates daily." },
    { spanish: "la cartera de inversiones", english: "investment portfolio", partOfSpeech: "frase", example: "Diversificar la cartera de inversiones reduce el riesgo financiero.", exampleTranslation: "Diversifying the investment portfolio reduces financial risk." },
    { spanish: "los dividendos", english: "dividends", partOfSpeech: "sustantivo", example: "Los accionistas reciben dividendos dos veces al año.", exampleTranslation: "Shareholders receive dividends twice a year." },
    { spanish: "la deuda", english: "debt", partOfSpeech: "sustantivo", example: "Muchos países latinoamericanos tienen una deuda externa considerable.", exampleTranslation: "Many Latin American countries have considerable external debt." },
    { spanish: "la bolsa de valores", english: "stock market", partOfSpeech: "frase", example: "La bolsa de valores de São Paulo es la mayor de América Latina.", exampleTranslation: "The São Paulo stock exchange is the largest in Latin America." },
    { spanish: "el impuesto", english: "tax", partOfSpeech: "sustantivo", example: "El impuesto sobre la renta varía según el nivel de ingresos.", exampleTranslation: "Income tax varies according to income level." },
    { spanish: "la rentabilidad", english: "return on investment / profitability", partOfSpeech: "sustantivo", example: "Analizaron la rentabilidad del proyecto antes de invertir.", exampleTranslation: "They analyzed the project's profitability before investing." },
    { spanish: "diversificar", english: "to diversify", partOfSpeech: "verbo", example: "Es prudente diversificar las fuentes de ingreso.", exampleTranslation: "It is prudent to diversify sources of income." },
    { spanish: "el presupuesto", english: "budget", partOfSpeech: "sustantivo", example: "El gobierno presentó un presupuesto equilibrado para el año próximo.", exampleTranslation: "The government presented a balanced budget for next year." },
  ],
  reading: {
    title: "Las economías de América Latina: volatilidad y resiliencia",
    sourceType: "ensayo",
    body:
      "Las economías de América Latina han experimentado décadas de volatilidad, marcadas por crisis de deuda, inflación galopante y devaluaciones monetarias que dejaron una huella profunda en la memoria colectiva de sus ciudadanos. Sin embargo, en los últimos veinte años, varias economías de la región han logrado una estabilidad macroeconómica notable.\n\nChile, Colombia y Perú han sido reconocidos por la solidez de sus marcos de política fiscal. El crecimiento de la clase media latinoamericana —estimada en 150 millones de personas— ha transformado los patrones de consumo, ahorro e inversión de la región. La irrupción del fintech ha llevado servicios financieros a millones de personas que nunca habían tenido una cuenta bancaria.\n\nNo obstante, la desigualdad sigue siendo el gran reto estructural de la región: América Latina es, junto con el África subsahariana, la zona más desigual del planeta en términos de distribución del ingreso. Crecer no es suficiente; la pregunta es para quién se crece.",
  },
  culturalNote: {
    heading: "Historia económica e identidad: el peso del pasado",
    body:
      "La relación de las culturas hispanas con el dinero y la economía está profundamente marcada por la historia. Países que vivieron hiperinflaciones devastadoras —Argentina en los años 80 y de nuevo en los 2000, Venezuela desde 2013— han desarrollado una desconfianza estructural hacia las instituciones financieras y una preferencia arraigada por el efectivo, los activos físicos y el dólar estadounidense como reserva de valor.\n\nEsta desconfianza no es irracional: es la respuesta racional a décadas de inestabilidad monetaria, de ahorros que se evaporaron de la noche a la mañana, de pensiones que perdieron su valor. Comprender estos contextos históricos es indispensable para entender las actitudes económicas actuales en el mundo hispano.\n\nEn España, la crisis económica de 2008-2013 transformó profundamente la relación de los españoles con el empleo, la vivienda y las instituciones. Una generación entera de jóvenes españoles altamente cualificados emigró a Europa y América Latina —el fenómeno llamado 'fuga de cerebros'— en busca de oportunidades que su país no podía ofrecerles.",
  },
};

const sp5_media: AdvancedUnitContent = {
  unitId: "9a43aceb-1ff4-4c8d-b303-0e9a786d1875",
  topicLabel: "Medios y Periodismo",
  levelBadge: "C1",
  vocabulary: [
    { spanish: "la crónica", english: "chronicle / journalistic piece", partOfSpeech: "sustantivo", example: "La crónica periodística narra los hechos con voz personal.", exampleTranslation: "The journalistic chronicle narrates events with a personal voice." },
    { spanish: "el reportaje", english: "in-depth report / feature story", partOfSpeech: "sustantivo", example: "El reportaje de investigación tardó seis meses en realizarse.", exampleTranslation: "The investigative report took six months to complete." },
    { spanish: "el titular", english: "headline", partOfSpeech: "sustantivo", example: "El titular debe captar la atención del lector de inmediato.", exampleTranslation: "The headline must immediately capture the reader's attention." },
    { spanish: "la fuente", english: "source", partOfSpeech: "sustantivo", example: "El periodista protege siempre la identidad de sus fuentes.", exampleTranslation: "The journalist always protects the identity of his sources." },
    { spanish: "la imparcialidad", english: "impartiality", partOfSpeech: "sustantivo", example: "La imparcialidad es uno de los pilares del periodismo ético.", exampleTranslation: "Impartiality is one of the pillars of ethical journalism." },
    { spanish: "el medio digital", english: "digital media outlet", partOfSpeech: "frase", example: "Los medios digitales han desplazado a la prensa impresa en muchos países.", exampleTranslation: "Digital media has displaced print press in many countries." },
    { spanish: "la desinformación", english: "disinformation / fake news", partOfSpeech: "sustantivo", example: "La desinformación en redes sociales es una amenaza para la democracia.", exampleTranslation: "Disinformation on social media is a threat to democracy." },
    { spanish: "el periodismo de investigación", english: "investigative journalism", partOfSpeech: "frase", example: "El periodismo de investigación expone la corrupción y los abusos de poder.", exampleTranslation: "Investigative journalism exposes corruption and abuses of power." },
    { spanish: "verificar", english: "to verify / to fact-check", partOfSpeech: "verbo", example: "Es esencial verificar la información antes de publicarla.", exampleTranslation: "It is essential to verify information before publishing it." },
    { spanish: "la audiencia", english: "audience", partOfSpeech: "sustantivo", example: "La audiencia de este podcast ha crecido un 300% en un año.", exampleTranslation: "This podcast's audience has grown 300% in one year." },
  ],
  reading: {
    title: "El periodismo latinoamericano: entre la verdad y el peligro",
    sourceType: "ensayo",
    body:
      "El periodismo en América Latina enfrenta hoy una paradoja aguda: nunca ha habido más medios de comunicación ni más acceso a la información, pero tampoco nunca ha sido más difícil distinguir la verdad de la mentira, ni más peligroso ejercer la profesión periodística.\n\nLa desinformación —especialmente a través de redes sociales como WhatsApp y Facebook— se ha convertido en una amenaza real para los procesos democráticos. Al mismo tiempo, el periodismo de investigación latinoamericano ha alcanzado cotas notables de calidad y valentía: publicaciones como El Faro (El Salvador), IDL-Reporteros (Perú) y La Silla Vacía (Colombia) han ganado reconocimiento internacional por sus investigaciones sobre corrupción y crimen organizado, a menudo arriesgando la vida de sus periodistas.\n\nMéxico es, en este sentido, un caso extremo: es el país más peligroso del mundo para los periodistas fuera de zonas de conflicto abierto. La defensa de la libertad de prensa es, en muchos países hispanohablantes, una lucha por la democracia misma.",
  },
  culturalNote: {
    heading: "La libertad de prensa en el mundo hispano",
    body:
      "La libertad de prensa en el mundo hispanohablante varía enormemente según el país y el momento histórico. España, Uruguay y Costa Rica se encuentran entre los países con mayor libertad de prensa en sus respectivas regiones. En contraste, Venezuela y Nicaragua han visto cómo el Estado cierra medios independientes y persigue a periodistas críticos con el gobierno.\n\nLa historia de la prensa en lengua española está marcada por momentos de enorme valentía: los periodistas que cubrieron las dictaduras militares de Argentina, Chile y España en pleno siglo XX, arriesgando su libertad y su vida, son figuras que el periodismo hispano recuerda con orgullo y deuda.\n\nHoy, el periodismo ciudadano y las redes sociales han democratizado la información, pero también han multiplicado la desinformación. La responsabilidad de verificar, contextualizar y buscar fuentes fiables recae ahora también sobre el lector. En una democracia saludable, el periodismo libre y el ciudadano informado son inseparables.",
  },
};

const sp5_heritage: AdvancedUnitContent = {
  unitId: "1cdfd605-b5ed-4cc3-a2d4-d8bd36719217",
  topicLabel: "Herencia Cultural",
  levelBadge: "C1",
  vocabulary: [
    { spanish: "el patrimonio", english: "heritage / patrimony", partOfSpeech: "sustantivo", example: "El patrimonio cultural de México es reconocido mundialmente.", exampleTranslation: "Mexico's cultural heritage is recognized worldwide." },
    { spanish: "la conservación", english: "conservation / preservation", partOfSpeech: "sustantivo", example: "La conservación de los monumentos históricos requiere inversión constante.", exampleTranslation: "The preservation of historical monuments requires constant investment." },
    { spanish: "el rito", english: "rite / ritual", partOfSpeech: "sustantivo", example: "Los ritos funerarios revelan la cosmovisión de una cultura.", exampleTranslation: "Funeral rites reveal the worldview of a culture." },
    { spanish: "el legado", english: "legacy", partOfSpeech: "sustantivo", example: "El legado de los incas se puede ver en la arquitectura de Cusco.", exampleTranslation: "The legacy of the Incas can be seen in the architecture of Cusco." },
    { spanish: "la tradición oral", english: "oral tradition", partOfSpeech: "frase", example: "La tradición oral transmite historias de generación en generación.", exampleTranslation: "Oral tradition transmits stories from generation to generation." },
    { spanish: "la artesanía", english: "craftsmanship / handicrafts", partOfSpeech: "sustantivo", example: "La artesanía textil de Oaxaca es reconocida en todo el mundo.", exampleTranslation: "Oaxacan textile craftsmanship is recognized worldwide." },
    { spanish: "la gastronomía", english: "gastronomy / cuisine", partOfSpeech: "sustantivo", example: "La gastronomía peruana es considerada una de las mejores del mundo.", exampleTranslation: "Peruvian gastronomy is considered one of the best in the world." },
    { spanish: "la lengua indígena", english: "indigenous language", partOfSpeech: "frase", example: "El quechua es la lengua indígena con más hablantes en América del Sur.", exampleTranslation: "Quechua is the indigenous language with the most speakers in South America." },
    { spanish: "transmitir", english: "to transmit / to pass down", partOfSpeech: "verbo", example: "Los abuelos transmiten las tradiciones a las nuevas generaciones.", exampleTranslation: "Grandparents pass down traditions to new generations." },
    { spanish: "preservar", english: "to preserve", partOfSpeech: "verbo", example: "Es urgente preservar las lenguas y culturas en peligro de extinción.", exampleTranslation: "It is urgent to preserve endangered languages and cultures." },
  ],
  reading: {
    title: "El patrimonio de la humanidad en el mundo hispano",
    sourceType: "cultural",
    body:
      "El mundo hispanohablante concentra una proporción extraordinaria del Patrimonio de la Humanidad reconocido por la UNESCO. México encabeza la lista de América Latina con 35 sitios declarados, entre ellos la ciudad prehispánica de Teotihuacán, el centro histórico de Oaxaca y la Reserva de la Biosfera de Sian Ka'an. España posee 50 sitios, incluyendo la Alhambra de Granada, el Camino de Santiago y las obras de Antonio Gaudí en Barcelona.\n\nPero el patrimonio inmaterial —las danzas, las lenguas, las recetas, los ritos, las canciones— es igualmente valioso y mucho más frágil. Se estima que en América Latina existen unas 400 lenguas indígenas vivas, pero muchas de ellas son habladas por menos de 1.000 personas y corren el riesgo real de desaparecer en las próximas décadas.\n\nPerder una lengua no es solo perder palabras: es perder una forma única de nombrar el tiempo, el espacio, las emociones y las relaciones entre las personas y el mundo que las rodea.",
  },
  culturalNote: {
    heading: "La gastronomía como patrimonio vivo",
    body:
      "La gastronomía es una de las formas más cotidianas y vivas del patrimonio cultural. Las cocinas de México, Perú y España han sido reconocidas entre las más complejas y sabrosas del mundo, y no por casualidad: son el resultado de siglos de intercambios, fusiones y reinvenciones culturales.\n\nLa gastronomía peruana es quizás el ejemplo más extraordinario: es el resultado de la fusión de técnicas culinarias andinas, europeas, africanas, japonesas y chinas, reflejo perfecto de la historia de un país que fue punto de llegada de inmigrantes de todo el mundo. El ceviche peruano, preparado con el ají y la técnica de cocción en ácido —'leche de tigre'— que viene de la tradición indígena, fue declarado Patrimonio Cultural de la Nación peruana.\n\nEn México, la cocina tradicional fue declarada Patrimonio Cultural Inmaterial de la Humanidad por la UNESCO en 2010. El mole, las tortillas de maíz nixtamalizado, el chocolate caliente: cada plato es un documento histórico, una forma de memoria que se come.",
  },
};

// ── Master list ───────────────────────────────────────────────────────────────

export const ADVANCED_UNITS: AdvancedUnitContent[] = [
  // Spanish 3
  sp3_identity,
  sp3_arts,
  sp3_history,
  sp3_careers,
  sp3_skills,
  sp3_tech,
  sp3_travel,
  sp3_health,
  // Spanish 4
  sp4_global,
  sp4_science,
  sp4_culture,
  sp4_ap,
  sp4_advLow,
  sp4_advMid,
  sp4_business,
  sp4_arts,
  // Spanish 5
  sp5_advHigh,
  sp5_finance,
  sp5_media,
  sp5_heritage,
];

export function getAdvancedUnitContent(unitId: string): AdvancedUnitContent | null {
  return ADVANCED_UNITS.find((u) => u.unitId === unitId) ?? null;
}
