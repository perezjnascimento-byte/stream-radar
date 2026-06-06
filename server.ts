import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { moviesDatabase } from './src/data/movies';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateHeuristicProfile(ratings: any[], favorites: string[]): any {
  const loveIds = new Set((ratings || []).filter(r => r.liked === 'love').map(r => r.movieId));
  const likeIds = new Set((ratings || []).filter(r => r.liked === 'like').map(r => r.movieId));
  const seenIds = new Set((ratings || []).filter(r => r.watched).map(r => r.movieId));

  const categoryScores: Record<string, number> = {};
  (ratings || []).forEach((r: any) => {
    const movie = moviesDatabase.find(m => m.id === r.movieId);
    if (movie) {
      const cat = movie.plotCategory;
      let score = 0;
      if (r.liked === 'love') score = 5;
      else if (r.liked === 'like') score = 3;
      else if (r.liked === 'ok') score = 1;
      else if (r.liked === 'dislike') score = -2;

      categoryScores[cat] = (categoryScores[cat] || 0) + score;
    }
  });

  let topCategory = 'Drama';
  let topCategoryScore = -999;
  Object.entries(categoryScores).forEach(([cat, score]) => {
    if (score > topCategoryScore) {
      topCategoryScore = score;
      topCategory = cat;
    }
  });

  let archetypeName = 'O Espectador Eclético';
  let archetypeDescription = 'Você transita com naturalidade por universos de diferentes texturas e tempos, apreciando a essência da narrativa.';
  let psychologicalAssessment = 'Seu perfil indica uma forte apreciação por narrativas com ricas construções conceituais de diretores renomados. Você busca histórias que desafiam a linearidade tradicional, valorizando tanto atuações expressivas quanto uma cinematografia marcante.';
  let preferredPacing = 'Tensão Crescente';
  let thematicFocus = 'Profundidade Psicológica';
  let dominantGenre = 'Drama';

  if (topCategory === 'Ficção Científica') {
    archetypeName = 'O Visionário dos Futuros Distantes';
    archetypeDescription = 'Fascinado por conceitos filosóficos futuristas, realidades alternativas e distopias que questionam nossa própria humanidade.';
    psychologicalAssessment = 'Sua mente busca expansão através de narrativas visionárias. Filmes que desafiam a física ordinária, exploram inteligência artificial ou abordam exploração espacial servem como combustível para o seu fascínio intelectual. O Roteiro e a coerência científica-filosófica são elementos vitais para você.';
    preferredPacing = 'Ritmo Contemplativo e Densidade';
    thematicFocus = 'Existencialismo Tecnológico';
    dominantGenre = 'Sci-Fi';
  } else if (topCategory === 'Suspense' || topCategory === 'Terror') {
    archetypeName = 'O Investigador das Sombras e Mistérios';
    archetypeDescription = 'Atraído pela tensão psicológica densa, segredos obscuros e o suspense que testa os limites do nervosismo humano.';
    psychologicalAssessment = 'Suas escolhas mostram apreço pela tensão psicológica, mistérios intrincados e pelo macabro artístico. Você se deleita na imersão atmosférica de ambientes claustrofóbicos e quebra-cabeças narrativos onde a verdade só é revelada nos momentos finais.';
    preferredPacing = 'Tensão Psicológica Crescente';
    thematicFocus = 'Psique Humana e Ocultismo';
    dominantGenre = 'Suspense';
  } else if (topCategory === 'Ação') {
    archetypeName = 'O Caçador de Adrenalina e Dinamismo';
    archetypeDescription = 'Valoriza o espetáculo visual de coreografias perfeitas, perseguições de tirar o fôlego e narrativas de alta energia.';
    psychologicalAssessment = 'Você busca o cinema de impacto imediato e excelente direção física. Histórias dinâmicas, confrontos morais vívidos e sequências eletrizantes de ação representam perfeitamente seu escapismo predileto. Para você, o dinamismo visual é fundamental.';
    preferredPacing = 'Rápido e Eletrizante';
    thematicFocus = 'Confronto Moral e Sobrevivência';
    dominantGenre = 'Ação';
  } else if (topCategory === 'Fantasia' || topCategory === 'Comédia') {
    archetypeName = 'O Alquimista da Imaginação e do Riso';
    archetypeDescription = 'Busca a magia de universos fantásticos, heróis lendários e doses finas de humor satírico e espirituoso.';
    psychologicalAssessment = 'Você aprecia o poder da imaginação ilimitada e o calor da comédia espirituosa. Seja explorando reinos místicos, terras míticas ou rindo de sátiras cotidianas habilmente escritas, seu foco está na leveza narrativa bem produzida.';
    preferredPacing = 'Leve e Divertido';
    thematicFocus = 'Mitologia Moderna e Ironia';
    dominantGenre = 'Fantasia';
  } else if (topCategory === 'Drama' || topCategory === 'Romance') {
    archetypeName = 'O Explorador da Alma e das Paixões';
    archetypeDescription = 'Sensível ao realismo dramático de complexos relacionamentos humanos, dilemas éticos e profundidade emocional.';
    psychologicalAssessment = 'O seu refúgio cinematográfico é o drama centrado em personagens complexos. Você se conecta fortemente com performances excepcionais, dilemas éticos realistas e de alta sensibilidade humana, prestando muita atenção na qualidade da atuação e do roteiro.';
    preferredPacing = 'Lento e Filosófico';
    thematicFocus = 'Dilemas Morais e Empatia';
    dominantGenre = 'Drama';
  }

  const narrativeThemesInCommon = [
    `Conflitos internos que moldam o destino dos personagens`,
    `Uso expressivo do som e da fotografia para criar atmosferas imersivas`,
    `A busca incessante por respostas em cenários de alta pressão ou isolamento`
  ];

  const genreBreakdownDetails = [
    { genre: 'Ficção Científica', analysis: 'Busca conceitos intelectuais que abordam paradoxos temporais e transição tecnológica.' },
    { genre: 'Drama', analysis: 'Valoriza as atuações densas e roteiros orientados ao preenchimento de vazios emocionais.' },
    { genre: 'Suspense', analysis: 'Aprecia reviravoltas na trama e um ritmo pontuado por mistérios insolúveis.' }
  ];

  const availableRecs = moviesDatabase.filter(m => !seenIds.has(m.id));
  const categoryRecs = availableRecs.filter(m => m.plotCategory === topCategory);
  
  const finalRecsList = [...categoryRecs, ...availableRecs].slice(0, 4);

  const customRecommendations = finalRecsList.map((m, idx) => {
    return {
      title: m.title,
      year: m.year,
      type: m.type as any,
      genres: m.genres,
      director: m.director,
      cast: m.cast,
      whereToWatch: m.platforms,
      matchPercentage: 98 - (idx * 3),
      reasonForSuggestion: `Recomendação especial offline selecionada por sintonia direta com o estilo dramático de ${m.director} que se adapta ao seu gosto em ${m.plotCategory.toLowerCase()}.`,
      plotCategory: m.plotCategory
    };
  });

  return {
    archetypeName,
    archetypeDescription,
    psychologicalAssessment,
    narrativeThemesInCommon,
    statisticsSummary: {
      dominantGenre,
      preferredPacing,
      thematicFocus
    },
    genreBreakdownDetails,
    customRecommendations
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for profiling and advanced recommendations
  app.post('/api/analyze-profile', async (req, res) => {
    try {
      const { ratings, favorites } = req.body;

      if (!ratings || ratings.length === 0) {
        return res.status(400).json({
          error: 'Por favor, avalie pelo menos um filme ou série para realizar a análise conceitual.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'A chave de API do Gemini (GEMINI_API_KEY) não está configurada nos segredos do projeto. Acesse Settings > Secrets no AI Studio e adicione-a.',
          needsConfig: true
        });
      }

      // Lazy initialization of GoogleGenAI
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare user context payload for prompt
      const promptContext = ratings.map((rating: any) => {
        let reaction = 'Gostou';
        if (rating.liked === 'love') reaction = 'Amei Absolutamente';
        if (rating.liked === 'ok') reaction = 'Achei OK / Meio Mais ou Menos / Apenas Legal (não gostou tanto a ponto de ser positivo)';
        if (rating.liked === 'dislike') reaction = 'Não Gostou';
        
        let details = '';
        if (rating.dontRemember) {
          details = ' [Memória fraca: o usuário não lembra muito dos detalhes do título]';
        } else {
          const scores: string[] = [];
          if (rating.actingScore) scores.push(`Atuação: ${rating.actingScore}/5`);
          if (rating.scriptScore) scores.push(`Roteiro/História: ${rating.scriptScore}/5`);
          if (rating.visualScore) scores.push(`Efeitos/Visual: ${rating.visualScore}/5`);
          if (scores.length > 0) {
            details = ` [Avaliado por aspectos detalhados: ${scores.join(', ')}]`;
          }
        }
        return `- Título ID: ${rating.movieId} | Avaliação: ${reaction}${details}`;
      }).join('\n');

      const favoritesContext = favorites && favorites.length > 0
        ? `Favoritos marcados: ${favorites.join(', ')}`
        : 'Nenhum favorito explícito além das avaliações positivas.';

      // Instruct Gemini
      const systemInstruction = `
        Você é um algoritmo analítico especializado de cinema, psicologia espectadora e curadoria cinematográfica avançada.
        Seu objetivo é cruzar os dados dos filmes/séries que o usuário já assistiu, as reações dele (Amei/gostou/não gostou) e seus favoritos para traçar um diagnóstico ultra analítico e preciso de seu perfil de conteúdo ideal.

        Analise de forma profunda:
        1. A estrutura psíquica e temática de suas tramas favoritas (Ex: busca existencial, jornadas redentoras, heróis imperfeitos, ficção científica cyberpunk que questiona a realidade).
        2. Crie uma nomenclatura fantástica para o Arquetipo de Espectador correspondente (Ex: "O Explorador de Labirintos Mentais", "O Escapista de Mundos Ancestrais", "O Analista de Decadência Urbana").
        3. Determine quais as semelhanças que amarram essas tramas e os tópicos mais fortes comuns (Ex: atmosfera sombria, reviravoltas intelectuais, suspense psicológico denso, humor cínico corporativo).
        4. Ofereça 4 recomendações novas, cirúrgicas, surpreendentes e extremamente nichadas de filmes ou séries que representem as plataformas listadas (Netflix, Prime Video, Disney+, Apple TV+, Max, Cinema) e detalhe minuciosamente por que elas se encaixam no perfil conceitual detalhado dele.

        As recomendações precisam obrigatoriamente existir no mundo real! Não crie títulos inventados. Escolha realizadores (diretores) lendários ou relevantes para cada recomendação que se alinhem com o estilo de Christopher Nolan, David Fincher, Villeneuve, Bong Joon Ho, Wes Anderson etc, de acordo com o gosto do espectador.
      `;

      const userPrompt = `
        Analise o histórico de avaliações do meu catálogo:
        
        ${promptContext}

        ${favoritesContext}

        Retorne o resultado final em formato JSON estrito conforme o esquema estipulado. Lembre-se, use o idioma "Português Brasileiro".
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              archetypeName: { 
                type: Type.STRING,
                description: "Nomenclatura poética e analítica do arquétipo de espectador"
              },
              archetypeDescription: { 
                type: Type.STRING,
                description: "Breve resumo descritivo do arquétipo"
              },
              psychologicalAssessment: { 
                type: Type.STRING,
                description: "Parágrafo com avaliação psicológica profunda de suas motivações cinematográficas e tipo de narrativa que mais o prende."
              },
              narrativeThemesInCommon: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 a 4 padrões temáticos recorrentes identificados no gosto do usuário"
              },
              statisticsSummary: {
                type: Type.OBJECT,
                properties: {
                  dominantGenre: { type: Type.STRING, description: "Gênero cinematográfico mais marcante e influente no seu gosto" },
                  preferredPacing: { type: Type.STRING, description: "Ritmo de narrativa preferido, ex: Lento e Filosófico, Ritmo Alucinante, Tensão Crescente" },
                  thematicFocus: { type: Type.STRING, description: "Foco temático principal de interesse, ex: Conspiração, Moralidade Humana, Busca de Identidade" }
                },
                required: ["dominantGenre", "preferredPacing", "thematicFocus"]
              },
              genreBreakdownDetails: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    genre: { type: Type.STRING, description: "Nome do gênero, ex: Suspense" },
                    analysis: { type: Type.STRING, description: "O que agrada o usuário especificamente neste tipo de gênero dramático de acordo com o catálogo avaliado" }
                  },
                  required: ["genre", "analysis"]
                }
              },
              customRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Título do filme/série recomendado" },
                    year: { type: Type.NUMBER, description: "Ano de lançamento oficial" },
                    type: { type: Type.STRING, description: "Tipo de produção: 'Filme' ou 'Série'" },
                    genres: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Gêneros do filme" },
                    director: { type: Type.STRING, description: "Diretor principal" },
                    cast: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Destaque de atores no elenco" },
                    whereToWatch: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Onde assistir (ex: [\"Netflix\", \"Max\"])" },
                    matchPercentage: { type: Type.NUMBER, description: "Porcentagem precisa de compatibilidade de 0 a 100 baseada no algoritmo cruzado" },
                    reasonForSuggestion: { type: Type.STRING, description: "Por que essa produção foi escolhida de acordo com o diretor/estilo do que ele assistiu" },
                    plotCategory: { type: Type.STRING, description: "Categoria dramática abrangente" }
                  },
                  required: ["title", "year", "type", "genres", "director", "whereToWatch", "matchPercentage", "reasonForSuggestion", "plotCategory"]
                },
                description: "Exatamente 4 recomendações altamente qualificadas e precisas no mercado real de streaming"
              }
            },
            required: [
              "archetypeName",
              "archetypeDescription",
              "psychologicalAssessment",
              "narrativeThemesInCommon",
              "statisticsSummary",
              "genreBreakdownDetails",
              "customRecommendations"
            ]
          }
        }
      });

      const responseText = response.text ? response.text.trim() : '';
      if (!responseText) {
        throw new Error('O modelo não retornou uma resposta válida.');
      }

      const parsedJSON = JSON.parse(responseText);
      return res.json(parsedJSON);

    } catch (error: any) {
      console.error('Erro no processamento da análise do Gemini. Ativando fallback heurístico local:', error);
      try {
        const { ratings, favorites } = req.body;
        const fallbackProfile = generateHeuristicProfile(ratings, favorites);
        return res.json(fallbackProfile);
      } catch (fallbackError: any) {
        console.error('Falha também no fallback de análise local:', fallbackError);
        return res.status(500).json({
          error: 'Erro ao gerar análise de perfil usando Inteligência Artificial.',
          details: error?.message || String(error)
        });
      }
    }
  });

  // API Route to fetch encyclopedic cinema details for any searched movie or series in raw-time
  app.post('/api/search-movie', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: 'Nenhum termo de busca fornecido.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'A chave de API do Gemini (GEMINI_API_KEY) não está configurada nos segredos do projeto.'
        });
      }

      // Initialize GoogleGenAI SDK
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `
        Você é uma enciclopédia cinematográfica global omnisciente que conhece detalhadamente todos os filmes e séries do planeta (+250.000 títulos).
        O usuário pesquisará por um título ou franquia (ex: "Matrix", "Interstellar", "Vingadores", "O Senhor dos Anéis"). 
        Você deve identificar os filmes ou séries correspondentes ao que ele buscou.
        Se ele pesquisar por uma franquia, retorne as produções principais relacionadas a ela em ordem cronológica (retorne até um limite de 6 itens).
        Se for um único filme ou série, retorne ele primeiramente. Você também pode incluir sequências diretas, prequelas ou partes correspondentes daquela franquia/universo cinematográfico se houver, para que o usuário possa visualizar a franquia inteira (ex: se pesquisou por "Duna", retorne "Duna: Parte Um" e "Duna: Parte Dois").
        Caso o termo de pesquisa seja incompleto ou tenha pequenos erros ortográficos, deduza e corrija para o título oficial correspondente com o ano correto de lançamento.
        Sua resposta de retorno DEVE ser um array JSON de objetos, traduzindo todos os campos textuais (como sinopse, plotType, etc.) para o idioma "Português Brasileiro".
        Escolha uma das seguintes strings estritas para o campo platforms: "Netflix", "Max", "Prime Video", "Disney+", "Apple TV+", "Cinema" ou "Outros".
        Para o campo plotCategory, o valor DEVE ser exatamente uma das opções seguintes: "Ficção Científica", "Ação", "Drama", "Comédia", "Suspense", "Fantasia", "Terror", "Romance" ou "Outros".
      `;

      const userPrompt = `Pesquisa do usuário: "${query}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: "Lista de filmes/séries encontrados que combinam com a pesquisa ou pertencem à mesma franquia.",
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Título oficial lançado no Brasil (ex: 'De Volta para o Futuro')" },
                originalTitle: { type: Type.STRING, description: "Título original em inglês ou outro idioma de origem (ex: 'Back to the Future')" },
                type: { type: Type.STRING, description: "Selecione exclusivamente 'Filme' ou 'Série'" },
                year: { type: Type.NUMBER, description: "Ano de lançamento oficial" },
                genres: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de 1 a 3 gêneros relacionados" },
                director: { type: Type.STRING, description: "Diretor do filme ou criador/showrunner principal" },
                cast: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Destaque de atores eminentes do elenco (máximo 4 atores)" },
                platforms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Plataformas de streaming ou meios mais comuns onde está disponível no Brasil" },
                plotType: { type: Type.STRING, description: "Frase poética sintetizando os tropos conceituais profundos e a atmosfera dramática" },
                plotCategory: { 
                  type: Type.STRING, 
                  description: "Categoria dramática abrangente de classificação: 'Ficção Científica', 'Ação', 'Drama', 'Comédia', 'Suspense', 'Fantasia', 'Terror', 'Romance', 'Outros'" 
                },
                synopsis: { type: Type.STRING, description: "Sinopse cativante e intrigante escrita em português do Brasil (no máximo 3 linhas)" }
              },
              required: [
                "title", 
                "originalTitle", 
                "type", 
                "year", 
                "genres", 
                "director", 
                "cast", 
                "platforms", 
                "plotType", 
                "plotCategory", 
                "synopsis"
              ]
            }
          }
        }
      });

      const responseText = response.text ? response.text.trim() : '';
      if (!responseText) {
        throw new Error('O modelo não retornou uma resposta válida para a busca do título.');
      }

      const movieData = JSON.parse(responseText);
      // Ensure we return an array even if something went wrong and a single object is returned
      const moviesArray = Array.isArray(movieData) ? movieData : [movieData];
      return res.json(moviesArray);

    } catch (error: any) {
      console.error('Erro na pesquisa inteligente de filmes via Gemini. Ativando fallback de busca local:', error);
      try {
        const targetQuery = req.body?.query || '';
        const normQuery = targetQuery.toLowerCase().trim();
        const localMatches = moviesDatabase.filter(m => {
          return m.title.toLowerCase().includes(normQuery) ||
            (m.originalTitle && m.originalTitle.toLowerCase().includes(normQuery)) ||
            m.director.toLowerCase().includes(normQuery) ||
            m.genres.some(g => g.toLowerCase().includes(normQuery)) ||
            m.cast.some(actor => actor.toLowerCase().includes(normQuery)) ||
            m.plotCategory.toLowerCase().includes(normQuery);
        }).slice(0, 6);

        // If we found local entries, return them. Otherwise return an empty array rather than failing with 500 error!
        return res.json(localMatches);
      } catch (fallbackError: any) {
        console.error('Falha também no fallback de busca do título:', fallbackError);
        return res.status(500).json({
          error: 'Erro ao encontrar informações detalhadas sobre esse título.',
          details: error?.message || String(error)
        });
      }
    }
  });

  // Serve static assets or mount Vite dev middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
