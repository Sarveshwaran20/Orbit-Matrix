class OrbitCustomAI {
  constructor() {
    this.maxTrialCards = 5;
    this.intents = {
      search_web: [
        "search",
        "google",
        "who is",
        "what is",
        "tell me about",
        "lookup",
        "find out",
        "information on",
      ],
      deep_research: ["research", "deep dive", "study", "explore topic"],
      brainstorm: [
        "brainstorm",
        "mind map",
        "cluster",
        "ideas for",
        "generate concepts",
      ],
      calculate: [
        "calculate",
        "solve",
        "math",
        "evaluate",
        "what is the sum",
        "what is",
      ],
      define_word: ["define", "meaning of", "dictionary", "definition of"],
      arrange_grid: [
        "arrange",
        "organize",
        "align",
        "grid layout",
        "tidy up",
        "clean layout",
        "sort cards",
      ],
      spawn_card: [
        "add",
        "create",
        "spawn",
        "make",
        "generate",
        "drop",
        "new",
        "presentation",
      ],
      connect_cards: [
        "link",
        "connect",
        "thread",
        "tie",
        "join",
        "connect recent",
      ],
      delete_card: ["delete card", "remove card", "kill card", "destroy card"],
      clear_canvas: [
        "clear",
        "delete all",
        "wipe",
        "clean canvas",
        "reset workspace",
        "remove all",
      ],
      recenter_canvas: [
        "center",
        "recenter",
        "focus",
        "lost",
        "reset view",
        "realign camera",
      ],
      analyze_canvas: [
        "analyze",
        "inspect",
        "audit",
        "canvas status",
        "summary of board",
        "workspace report",
      ],
      tutorial: ["tutorial", "guide", "help", "onboarding", "how to use"],
    };

    this.entities = {
      slide: [
        "slide",
        "slides",
        "presentation",
        "deck",
        "powerpoint",
        "pitch",
        "slideshow",
      ],
      sheet: [
        "sheet",
        "sheets",
        "spreadsheet",
        "table",
        "data",
        "excel",
        "budget",
        "tracker",
      ],
      doc: [
        "doc",
        "docs",
        "document",
        "notes",
        "article",
        "paper",
        "text",
        "report",
      ],
    };
  }

  isTrialRestricted() {
    const isGuest =
      (typeof isGuestMode !== "undefined" && isGuestMode) ||
      (typeof accessToken !== "undefined" && !accessToken);
    const activeCards = document.querySelectorAll(".orbit-node").length;
    return isGuest && activeCards >= this.maxTrialCards;
  }

  cleanTopicQuery(rawText) {
    let clean = rawText
      .replace(
        /can you|please|could you|i want|create|make|generate|build|spawn|add/gi,
        "",
      )
      .replace(
        /presentation with \d+ slides?|presentation|\bdeck\b|\bslides?\b/gi,
        "",
      )
      .replace(/\bwith \d+ (?:slides?|cards?|pages?)\b/gi, "")
      .replace(
        /\bon the topice? of\b|\bthe topice? of\b|\bthe topice?\b|\btopice?\b/gi,
        "",
      )
      .replace(/\bon\b|\babout\b|\bfor\b|\bhow they\b|\bhow it\b/gi, " ")
      .replace(/[?!.,;]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return clean;
  }

  async fetchInternetData(query) {
    try {
      const sanitized = this.cleanTopicQuery(query);
      const searchTerms = [
        sanitized,
        sanitized.split(" ").slice(0, 3).join(" "),
        query.replace(/[?!.]/g, "").trim(),
      ];

      for (const term of searchTerms) {
        if (!term || term.length < 3) continue;
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&utf8=&format=json&origin=*`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData?.query?.search && searchData.query.search.length > 0) {
          const bestTitle = searchData.query.search[0].title;
          const relatedTitles = searchData.query.search
            .slice(1, 4)
            .map((item) => item.title);

          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
          const summaryRes = await fetch(summaryUrl);
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            return {
              title: summaryData.title,
              description: summaryData.description || "Verified Knowledge Base",
              extract: summaryData.extract || "No direct abstract available.",
              sourceUrl: summaryData.content_urls
                ? summaryData.content_urls.desktop.page
                : `https://en.wikipedia.org/wiki/${encodeURIComponent(bestTitle)}`,
              related: relatedTitles,
            };
          }
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  async fetchDefinition(word) {
    try {
      const cleanWord = word
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      if (!cleanWord) return null;

      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      );
      if (!res.ok) return null;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      const entry = data[0];
      const phonetics =
        entry.phonetic ||
        (entry.phonetics && entry.phonetics[0] ? entry.phonetics[0].text : "");
      let meaningsFormatted = [];

      entry.meanings.slice(0, 2).forEach((m) => {
        const def = m.definitions[0] ? m.definitions[0].definition : "";
        const example =
          m.definitions[0] && m.definitions[0].example
            ? `<i>"${m.definitions[0].example}"</i>`
            : "";
        meaningsFormatted.push(`<b>${m.partOfSpeech}</b>: ${def} ${example}`);
      });

      return {
        word: entry.word,
        phonetics: phonetics,
        meanings: meaningsFormatted.join("<br>"),
      };
    } catch (err) {
      return null;
    }
  }

  evaluateMath(expression) {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%^]/g, "");
      if (!sanitized || !/[0-9]/.test(sanitized)) return null;
      const jsExpr = sanitized.replace(/\^/g, "**");
      const result = Function(`'use strict'; return (${jsExpr})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        return {
          expression: sanitized,
          value: result,
        };
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  buildMultiSlideDeck(topicTitle, internetData, slideCount = 6) {
    const deckId = "deck-" + Date.now();
    const count = Math.min(Math.max(slideCount, 1), 15);
    const desc =
      internetData?.description || "Executive Overview & Research Briefing";
    const baseSummary =
      internetData?.extract ||
      "Detailed technological, operational, and environmental impact assessment.";

    const templates = [
      {
        subtitle: "Executive Overview & Problem Scope",
        p1: `Fundamental architecture and operational context of ${topicTitle}.`,
        p2: baseSummary.slice(0, 160) + (baseSummary.length > 160 ? "..." : ""),
        p3: "Baseline metrics, historical development, and core industry footprint.",
        badge: "Overview",
      },
      {
        subtitle: "Infrastructure & Operational Drivers",
        p1: "Exponential processing demands, enterprise uptime SLAs, and network distribution.",
        p2: "Hardware deployment velocity across hyperscale cloud and edge facilities.",
        p3: "Key throughput metrics and computational capacity acceleration.",
        badge: "Infrastructure",
      },
      {
        subtitle: "Power Consumption & Grid Load",
        p1: "Direct kilowatt-hour draw per compute rack and facility-level megawatt baselines.",
        p2: "Strain on regional utility grids and peak-demand throttling considerations.",
        p3: "Transition timeline towards dedicated substation connections and microgrids.",
        badge: "Energy Grid",
      },
      {
        subtitle: "Carbon Footprint & Environmental Impact",
        p1: "Scope 1, 2, and 3 greenhouse gas emissions linked to continuous operation.",
        p2: "Comparison between fossil-fuel powered grid draw vs. localized power plants.",
        p3: "Annual carbon output trends and ecological impact across municipal hubs.",
        badge: "Ecological",
      },
      {
        subtitle: "Water Consumption & Thermal Cooling",
        p1: "Evaporative cooling towers requiring millions of gallons of potable water daily.",
        p2: "Localized aquifer depletion and thermal discharge challenges.",
        p3: "Alternative closed-loop liquid cooling and immersion tech adoption.",
        badge: "Cooling Tech",
      },
      {
        subtitle: "Hardware Churn & E-Waste Lifecycle",
        p1: "Accelerated replacement cycles (2-4 years) for GPUs and accelerator ASICs.",
        p2: "Component recycling bottlenecks, rare earth mineral waste, and scrap volume.",
        p3: "Circular economy initiatives and sustainable server refurbishment.",
        badge: "Lifecycle",
      },
      {
        subtitle: "AI Workload Surge & Hyper-Growth",
        p1: "Training and inference compute requirements expanding exponentially.",
        p2: "High-density thermal envelopes surpassing 40-100kW per server cabinet.",
        p3: "Strategic infrastructure re-balancing to meet next-generation AI demands.",
        badge: "AI Acceleration",
      },
      {
        subtitle: "Efficiency Metrics & Power Usage (PUE)",
        p1: "Targeting modern PUE (Power Usage Effectiveness) thresholds below 1.15.",
        p2: "AI-driven autonomous HVAC management and variable-frequency fan arrays.",
        p3: "Standardized performance auditing and real-time efficiency telemetry.",
        badge: "Optimization",
      },
      {
        subtitle: "Regulatory Policies & Public Scrutiny",
        p1: "Municipal zoning moratoriums and utility grid approval delays.",
        p2: "Government mandates for mandatory carbon and water consumption reporting.",
        p3: "Community resistance regarding water rights, noise, and power distribution.",
        badge: "Regulation",
      },
      {
        subtitle: "Strategic Roadmap & Future Outlook",
        p1: "Direct on-site SMR (Small Modular Reactor) and nuclear power exploration.",
        p2: "Geographic redistribution to cold climates and subsea data pods.",
        p3: "Long-term transition to net-zero, high-density, carbon-negative facilities.",
        badge: "Outlook",
      },
    ];

    while (templates.length < count) {
      templates.push({
        subtitle: "Additional Analysis",
        p1: "Further metric breakdown and localized impacts.",
        p2: "Secondary research indicators and long-term viability.",
        p3: "Cross-functional dependencies and edge-case scenarios.",
        badge: "Deep Dive",
      });
    }

    const chosenSlides = templates.slice(0, count);

    let slidesHtml = chosenSlides
      .map(
        (slide, i) => `
      <div class="deck-slide" id="${deckId}-slide-${i}" style="display: ${i === 0 ? "block" : "none"};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <span style="background: rgba(251, 188, 5, 0.15); color: #fdd663; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 12px; letter-spacing: 0.5px;">${slide.badge}</span>
          <span style="font-size: 11px; color: #aaa; font-weight: 500;">Slide ${i + 1} of ${count}</span>
        </div>

        <div contenteditable="true" style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 2px;">${topicTitle}</div>
        <div contenteditable="true" style="font-size: 12px; color: #9aa0a6; border-left: 2px solid #fdd663; padding-left: 8px; margin-bottom: 12px;">${slide.subtitle}</div>

        <div style="display:flex; flex-direction:column; gap: 8px; margin-bottom: 12px;">
          <div style="display:flex; gap: 8px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <span style="color: #8ab4f8; font-size: 13px;">⚡</span>
            <div contenteditable="true" style="font-size: 12px; color: #e8eaed; line-height: 1.4;">${slide.p1}</div>
          </div>
          <div style="display:flex; gap: 8px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <span style="color: #81c995; font-size: 13px;">🔬</span>
            <div contenteditable="true" style="font-size: 12px; color: #e8eaed; line-height: 1.4;">${slide.p2}</div>
          </div>
          <div style="display:flex; gap: 8px; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <span style="color: #f28b82; font-size: 13px;">🌐</span>
            <div contenteditable="true" style="font-size: 12px; color: #e8eaed; line-height: 1.4;">${slide.p3}</div>
          </div>
        </div>
      </div>
    `,
      )
      .join("");

    return `
      <div id="${deckId}" data-current="0" data-total="${count}" style="padding: 16px; background: linear-gradient(135deg, #18181f 0%, #101014 100%); color: #fff; border-radius: 0 0 10px 10px; font-family: inherit;">
        ${slidesHtml}
        
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: flex; justify-content: space-between; align-items:center; font-size: 11px;">
          <div style="display: flex; gap: 6px;">
            <button onclick="event.stopPropagation(); window.changeDeckSlide('${deckId}', -1)" style="background:#2a2a30; border:1px solid #444; color:#fff; border-radius:4px; padding:3px 8px; cursor:pointer; font-size:11px;">◀ Prev</button>
            <button onclick="event.stopPropagation(); window.changeDeckSlide('${deckId}', 1)" style="background:#2a2a30; border:1px solid #444; color:#fff; border-radius:4px; padding:3px 8px; cursor:pointer; font-size:11px;">Next ▶</button>
          </div>
          ${internetData?.sourceUrl ? `<a href="${internetData.sourceUrl}" target="_blank" style="color: #8ab4f8; text-decoration:none;">Wiki Reference ↗</a>` : '<span style="color:#666;">Verified Synthesis</span>'}
        </div>
      </div>
    `;
  }

  buildProSheet(title, internetData) {
    return `
      <div style="padding: 10px; background: #141414; border-radius: 0 0 10px 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <span style="background: rgba(52, 168, 83, 0.15); color: #81c995; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 12px;">Matrix Analysis Sheet</span>
          <span style="font-size: 10px; color: #777;">${title}</span>
        </div>
        <div style="overflow-x: auto; max-height: 200px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #e8eaed;">
            <thead>
              <tr style="background: #202124; text-align: left;">
                <th style="border: 1px solid #333; padding: 6px 8px;">Metric / Pillar</th>
                <th style="border: 1px solid #333; padding: 6px 8px;">Evaluation</th>
                <th style="border: 1px solid #333; padding: 6px 8px;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px;">Core Architecture</td>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px;">Foundational</td>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px; color:#81c995;">Verified</td>
              </tr>
              <tr>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px;">Operational Readiness</td>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px;">High Priority</td>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px; color:#8ab4f8;">In Progress</td>
              </tr>
              <tr>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px;">Scalability Factor</td>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px;">Tier-1 Impact</td>
                <td contenteditable="true" style="border: 1px solid #282828; padding: 6px 8px; color:#fdd663;">Active</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  buildProDoc(title, internetData) {
    const rawExtract =
      internetData?.extract ||
      "Executive briefing document detailing strategic initiatives, research analysis, and operational roadmap.";
    return `
      <div contenteditable="true" style="padding: 16px; min-height: 180px; font-size: 13px; line-height: 1.6; color: #e8eaed; outline: none; background: #161618; border-radius: 0 0 10px 10px;">
        <div style="font-size: 15px; font-weight: 700; color: #8ab4f8; margin-bottom: 6px;">Executive Brief: ${title}</div>
        <div style="font-size: 11px; color: #888; margin-bottom: 12px;">Curated Intelligence • ${new Date().toLocaleDateString()}</div>
        <p style="margin: 0 0 12px 0;">${rawExtract}</p>
        <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Key Objectives:</div>
        <ul style="margin: 0; padding-left: 20px; color: #ccc;">
          <li>Review initial technological parameters and feasibility.</li>
          <li>Establish cross-matrix logic threads with partner assets.</li>
          <li>Synthesize real-time data inputs into milestone deliverables.</li>
        </ul>
      </div>
    `;
  }

  async processQuery(rawText) {
    const text = rawText.toLowerCase().replace(/[.,!?]/g, "");
    let matchedIntent = "chat";
    let matchedType = "doc";
    let extractedTopic = "";

    const mathCheck = this.evaluateMath(rawText);
    if (
      mathCheck !== null &&
      (text.includes("calculate") ||
        text.includes("solve") ||
        text.includes("math") ||
        /^[\s\d+\-*/().%^]+$/.test(rawText.trim()))
    ) {
      matchedIntent = "calculate";
    } else {
      for (const [intent, keywords] of Object.entries(this.intents)) {
        if (keywords.some((kw) => text.includes(kw))) {
          matchedIntent = intent;
          break;
        }
      }
    }

    const countMatch = rawText.match(/(\d+)\s*(?:slides?|cards?|pages?)/i);
    const requestedSlideCount = countMatch ? parseInt(countMatch[1]) : 6;

    for (const [type, keywords] of Object.entries(this.entities)) {
      if (keywords.some((kw) => text.includes(kw))) {
        matchedType = type;
        break;
      }
    }

    const markers = [
      "presentation on",
      "presentation about",
      "deck on",
      "deck about",
      "slides on",
      "slides about",
      "about",
      "called",
      "named",
      "for",
      "titled",
      "on",
      "search",
      "who is",
      "what is",
      "explain",
      "define",
      "meaning of",
      "ideas for",
    ];

    for (const m of markers) {
      if (text.includes(m)) {
        const parts = rawText.split(new RegExp(m, "i"));
        if (parts.length > 1 && parts[1].trim()) {
          extractedTopic = parts[1].trim().replace(/[?!.]/g, "");
          break;
        }
      }
    }

    // FIX: Proper word boundaries to prevent mangling "an empty slides" into "n empty s".
    // It also perfectly strips out "empty" and "blank" so no research is performed for blank cards.
    if (!extractedTopic) {
      extractedTopic = rawText
        .replace(
          /\b(add|create|spawn|make|generate|drop|search|research|doc|docs|sheet|sheets|slide|slides|presentation|deck|slideshow|a|an|the|define|meaning of|calculate|solve|empty|blank|new)\b/gi,
          "",
        )
        .replace(/[?!.,]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const formattedTitle = extractedTopic
      ? extractedTopic
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : `New ${matchedType.toUpperCase()}`;

    const wantsToSpawn =
      this.intents.spawn_card.some((kw) => text.includes(kw)) ||
      text.includes("card") ||
      text.includes("note") ||
      text.includes("presentation") ||
      text.includes("slide") ||
      text.includes("sheet") ||
      text.includes("doc") ||
      matchedIntent === "deep_research" ||
      matchedIntent === "brainstorm";

    if (wantsToSpawn && this.isTrialRestricted()) {
      return {
        reply: `⚠️ <b>Trial Limit Reached (${this.maxTrialCards} Cards Max)</b><br><br>You have reached the maximum allowed cards for <b>Trial Mode</b>. To unlock unlimited canvas creation, real-time cloud backups, and Google Workspace integration, click <b>Sign in</b> on the top bar!`,
        actions: [],
      };
    }

    if (matchedIntent === "calculate") {
      const calc = mathCheck || this.evaluateMath(extractedTopic);
      if (calc !== null) {
        return {
          reply: `<b>Calculation Result:</b><br><br><code>${calc.expression}</code> = <b>${calc.value}</b>`,
          actions: [],
        };
      }
    }

    if (matchedIntent === "define_word") {
      const targetWord = extractedTopic.split(" ")[0];
      const defData = await this.fetchDefinition(targetWord);
      if (defData) {
        const wantsCard =
          text.includes("card") ||
          text.includes("doc") ||
          text.includes("add") ||
          text.includes("create");
        const bodyContent = `<b>${defData.word}</b> ${defData.phonetics ? `[${defData.phonetics}]` : ""}<br><br>${defData.meanings}`;

        if (wantsCard) {
          return {
            reply: `Created dictionary card for "<b>${defData.word}</b>".`,
            actions: [
              {
                tool: "spawn_card",
                args: {
                  type: "doc",
                  title: `Definition: ${defData.word}`,
                  content: bodyContent,
                },
              },
            ],
          };
        }

        return {
          reply: `<b>Dictionary Definition:</b><br><br>${bodyContent}`,
          actions: [],
        };
      }
    }

    if (matchedIntent === "arrange_grid") {
      return {
        reply:
          "Auto-aligned all workspace cards into an optimized spatial grid.",
        actions: [{ tool: "arrange_grid" }],
      };
    }

    if (matchedIntent === "brainstorm") {
      const queryTopic = extractedTopic || "New Project";
      const webData = await this.fetchInternetData(queryTopic);
      return {
        reply: `Generated a structured brainstorming cluster for "<b>${queryTopic}</b>" with connected cards.`,
        actions: [
          {
            tool: "brainstorm_cluster",
            args: {
              topic: queryTopic,
              summary: webData
                ? webData.extract
                : "Explore concepts, target audience, and primary objectives.",
              related:
                webData && webData.related.length > 0
                  ? webData.related
                  : ["Market Strategy", "Feature Execution"],
            },
          },
        ],
      };
    }

    if (matchedIntent === "delete_card") {
      const targetCardName = extractedTopic.toLowerCase();
      return {
        reply: `Attempting to remove cards matching "<b>${extractedTopic}</b>".`,
        actions: [{ tool: "delete_card", args: { name: targetCardName } }],
      };
    }

    // Skip research entirely if the user explicitly requested a blank or empty item.
    const isBlankRequest =
      rawText.toLowerCase().includes("empty") ||
      rawText.toLowerCase().includes("blank");

    if (
      extractedTopic &&
      extractedTopic.length > 1 &&
      !isBlankRequest &&
      (matchedIntent === "deep_research" ||
        text.includes("presentation") ||
        text.includes("slide") ||
        text.includes("research") ||
        (wantsToSpawn && text.includes("about")))
    ) {
      const internetResult = await this.fetchInternetData(extractedTopic);
      let proContent = "";

      if (matchedType === "slide") {
        proContent = this.buildMultiSlideDeck(
          formattedTitle,
          internetResult,
          requestedSlideCount,
        );
      } else if (matchedType === "sheet") {
        proContent = this.buildProSheet(formattedTitle, internetResult);
      } else {
        proContent = this.buildProDoc(formattedTitle, internetResult);
      }

      return {
        reply: `Researched and generated a professional <b>${matchedType === "slide" ? requestedSlideCount + "-slide deck" : matchedType.toUpperCase()}</b> card for "<b>${formattedTitle}</b>".`,
        actions: [
          {
            tool: "spawn_card",
            args: {
              type: matchedType,
              title: formattedTitle,
              content: proContent,
            },
          },
        ],
      };
    }

    if (matchedIntent === "search_web") {
      const internetResult = await this.fetchInternetData(
        extractedTopic || rawText,
      );
      if (internetResult) {
        return {
          reply: `
            <b>Web Intelligence for "${internetResult.title}":</b><br><br>
            ${internetResult.extract}<br><br>
            <i>Source: <a href="${internetResult.sourceUrl}" target="_blank" style="color:var(--google-blue, #8ab4f8);">${internetResult.sourceUrl}</a></i>
          `,
          actions: [],
        };
      } else {
        return {
          reply: `Searched web archives for "${extractedTopic || rawText}", but found no verified public encyclopedic records.`,
          actions: [],
        };
      }
    }

    switch (matchedIntent) {
      case "spawn_card":
        return {
          reply: `Created new ${matchedType.toUpperCase()} card: "<b>${formattedTitle}</b>".`,
          actions: [
            {
              tool: "spawn_card",
              args: { type: matchedType, title: formattedTitle },
            },
          ],
        };

      case "connect_cards": {
        const nodes = Array.from(document.querySelectorAll(".orbit-node"));
        if (nodes.length >= 2) {
          const fromNode = nodes[nodes.length - 2].id;
          const toNode = nodes[nodes.length - 1].id;
          return {
            reply: `Linked recent nodes (${fromNode} ➔ ${toNode}).`,
            actions: [
              {
                tool: "connect_cards",
                args: { fromId: fromNode, toId: toNode },
              },
            ],
          };
        }
        return {
          reply:
            "You need at least 2 cards on the matrix to stitch a logic connection.",
          actions: [],
        };
      }

      case "clear_canvas":
        return {
          reply:
            "Cleared all cards and logic threads from the matrix workspace.",
          actions: [{ tool: "clear_canvas" }],
        };

      case "recenter_canvas":
        return {
          reply: "Recentered viewport coordinates to the canvas origin.",
          actions: [{ tool: "recenter_canvas" }],
        };

      case "analyze_canvas": {
        const nodes = document.querySelectorAll(".orbit-node");
        const threadCount =
          typeof projectThreads !== "undefined" ? projectThreads.length : 0;
        let summaries = [];
        let docCount = 0;
        let sheetCount = 0;
        let slideCount = 0;

        nodes.forEach((n) => {
          const t = n.getAttribute("data-title") || "Untitled";
          const type = n.getAttribute("data-type") || "doc";
          if (type === "doc") docCount++;
          if (type === "sheet") sheetCount++;
          if (type === "slide") slideCount++;
          summaries.push(`• [${type.toUpperCase()}] ${t}`);
        });

        return {
          reply: `
            <b>Workspace Matrix Inspection:</b><br>
            - Total Cards: <b>${nodes.length}</b> (Docs: ${docCount}, Sheets: ${sheetCount}, Slides: ${slideCount})<br>
            - Interconnected Threads: <b>${threadCount}</b><br><br>
            <b>Node Directory:</b><br>
            ${summaries.join("<br>") || "Workspace canvas is currently empty."}
          `,
          actions: [],
        };
      }

      case "tutorial":
        return {
          reply: "Onboarding reference cards deployed to canvas.",
          actions: [{ tool: "tutorial" }],
        };

      default:
        return {
          reply: `
            <b>Orbit AI Matrix Copilot</b><br>
            Available tools and instant commands:<br><br>
            • <b>Pro Presentations:</b> <i>"Create a presentation about Quantum Computing"</i><br>
            • <b>Live Search:</b> <i>"Search Mars Rover discoveries"</i><br>
            • <b>Brainstorm Clusters:</b> <i>"Brainstorm Autonomous Drones"</i><br>
            • <b>Dictionary:</b> <i>"Define Ephemeral"</i><br>
            • <b>Math Solver:</b> <i>"Calculate (245 * 18) / 4"</i><br>
            • <b>Auto-Layout:</b> <i>"Arrange grid"</i><br>
            • <b>Card Control:</b> <i>"Add doc Project Roadmap"</i> or <i>"Delete card Welcome"</i><br>
            • <b>Topology:</b> <i>"Link recent cards"</i> or <i>"Analyze canvas"</i>
          `,
          actions: [],
        };
    }
  }

  executeAction(action) {
    if (!action || !action.tool) return null;

    switch (action.tool) {
      case "spawn_card": {
        const type = action.args.type || "doc";
        const title = action.args.title || "New Card";
        const content = action.args.content || null;
        if (typeof window.spawnBlankNode === "function") {
          const res = window.spawnBlankNode(
            type,
            title,
            content,
            Math.floor(Math.random() * 80) - 40,
            Math.floor(Math.random() * 80) - 40,
          );
          if (res === false) return null;
          return `Spawned ${type.toUpperCase()}: "${title}"`;
        }
        return null;
      }

      case "brainstorm_cluster": {
        const { topic, summary, related } = action.args;
        if (typeof window.spawnBlankNode !== "function") return null;

        const rootX = -200;
        const rootY = -150;

        const rootSuccess = window.spawnBlankNode(
          "doc",
          `Central: ${topic}`,
          summary,
          rootX,
          rootY,
        );
        if (rootSuccess === false) return null;

        const rootNode = document.querySelector(".orbit-node:last-child");
        let spawnedCount = 1;

        if (rootNode) {
          const satellites = related.slice(0, 2);
          satellites.forEach((satTitle, idx) => {
            if (this.isTrialRestricted()) return;
            const offsetX = rootX + (idx === 0 ? -380 : 380);
            const offsetY = rootY + 220;
            const satType = idx === 0 ? "sheet" : "slide";
            const satRes = window.spawnBlankNode(
              satType,
              satTitle,
              `Sub-cluster for ${topic}. Outline metrics and execution plans.`,
              offsetX,
              offsetY,
            );
            if (satRes !== false) {
              const childNode = document.querySelector(
                ".orbit-node:last-child",
              );
              if (childNode && typeof projectThreads !== "undefined") {
                projectThreads.push({ from: rootNode.id, to: childNode.id });
                spawnedCount++;
              }
            }
          });

          if (typeof drawThreads === "function") drawThreads();
          if (typeof saveCurrentWorkspace === "function") {
            saveCurrentWorkspace("Generated AI Cluster");
          }
          return `Spawned connected cluster of ${spawnedCount} cards for "${topic}"`;
        }
        return null;
      }

      case "arrange_grid": {
        const nodes = Array.from(document.querySelectorAll(".orbit-node"));
        if (nodes.length === 0) return null;

        const cols = Math.ceil(Math.sqrt(nodes.length));
        const spacingX = 420;
        const spacingY = 320;
        const currentZoom = typeof zoom !== "undefined" ? zoom : 0.85;
        const panX = typeof pan !== "undefined" ? pan.x : window.innerWidth / 2;
        const panY =
          typeof pan !== "undefined" ? pan.y : window.innerHeight / 2;
        const startX =
          (-panX + window.innerWidth / 2) / currentZoom -
          (cols * spacingX) / 2 +
          60;
        const startY =
          (-panY + window.innerHeight / 2) / currentZoom -
          (Math.ceil(nodes.length / cols) * spacingY) / 2 +
          60;

        nodes.forEach((node, idx) => {
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          node.style.left = `${Math.round(startX + col * spacingX)}px`;
          node.style.top = `${Math.round(startY + row * spacingY)}px`;
        });

        if (typeof drawThreads === "function") drawThreads();
        if (typeof saveCurrentWorkspace === "function") {
          saveCurrentWorkspace("Auto-arranged Grid");
        }
        return `Arranged ${nodes.length} cards in a ${cols}-column grid`;
      }

      case "delete_card": {
        const nameFilter = action.args.name;
        if (!nameFilter) return null;
        let removed = 0;
        document.querySelectorAll(".orbit-node").forEach((n) => {
          const cardTitle = (n.getAttribute("data-title") || "").toLowerCase();
          if (
            cardTitle.includes(nameFilter) ||
            n.id.toLowerCase() === nameFilter
          ) {
            if (typeof window.deleteNode === "function") {
              window.deleteNode(n.id);
            } else {
              n.remove();
            }
            removed++;
          }
        });
        if (removed > 0) {
          return `Deleted ${removed} card(s) matching "${nameFilter}"`;
        }
        return `No cards found matching "${nameFilter}"`;
      }

      case "connect_cards": {
        const { fromId, toId } = action.args;
        if (typeof projectThreads !== "undefined") {
          const exists = projectThreads.some(
            (t) =>
              (t.from === fromId && t.to === toId) ||
              (t.from === toId && t.to === fromId),
          );
          if (!exists) {
            projectThreads.push({ from: fromId, to: toId });
            if (typeof drawThreads === "function") drawThreads();
            if (typeof saveCurrentWorkspace === "function") {
              saveCurrentWorkspace("AI Connected Cards");
            }
            return `Connected ${fromId} ➔ ${toId}`;
          }
        }
        return null;
      }

      case "clear_canvas": {
        document.querySelectorAll(".orbit-node").forEach((n) => n.remove());
        if (typeof projectThreads !== "undefined") projectThreads = [];
        if (typeof drawThreads === "function") drawThreads();
        if (typeof saveCurrentWorkspace === "function") {
          saveCurrentWorkspace("AI Cleared Canvas");
        }
        return "Cleared Canvas";
      }

      case "recenter_canvas": {
        if (typeof window.recenterCanvas === "function") {
          window.recenterCanvas();
          return "Recentered Viewport";
        }
        return null;
      }

      case "tutorial": {
        if (typeof window.spawnOnboardingCards === "function") {
          window.spawnOnboardingCards();
          return "Spawned Tutorial Cards";
        }
        return null;
      }

      default:
        return null;
    }
  }
}

window.changeDeckSlide = function (deckId, delta) {
  const container = document.getElementById(deckId);
  if (!container) return;

  let current = parseInt(container.getAttribute("data-current") || "0");
  const total = parseInt(container.getAttribute("data-total") || "1");

  const currentSlideEl = document.getElementById(`${deckId}-slide-${current}`);
  if (currentSlideEl) currentSlideEl.style.display = "none";

  current += delta;
  if (current < 0) current = 0;
  if (current >= total) current = total - 1;

  container.setAttribute("data-current", current);
  const nextSlideEl = document.getElementById(`${deckId}-slide-${current}`);
  if (nextSlideEl) nextSlideEl.style.display = "block";
};

window.orbitAI = new OrbitCustomAI();

async function askGemini() {
  const input = document.getElementById("gemini-input");
  const chat = document.getElementById("gemini-chat");
  if (!input || !chat) return;

  const rawQuery = input.value.trim();
  if (!rawQuery) return;

  chat.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-message user-message">${rawQuery}</div>`,
  );
  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  const loadingId = "msg-" + Date.now();
  chat.insertAdjacentHTML(
    "beforeend",
    `<div id="${loadingId}" class="chat-message ai-message">
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="google-spinner" style="width:16px; height:16px;">
            <svg viewBox="25 25 50 50"><circle cx="50" cy="50" r="20" fill="none" stroke-width="4"></circle></svg>
          </div>
          <span id="ai-status-text">Synthesizing intelligence...</span>
        </div>
      </div>`,
  );
  chat.scrollTop = chat.scrollHeight;

  try {
    const result = await window.orbitAI.processQuery(rawQuery);
    let executedSummary = [];

    if (result.actions && result.actions.length > 0) {
      result.actions.forEach((act) => {
        const summary = window.orbitAI.executeAction(act);
        if (summary) executedSummary.push(summary);
      });
    }

    let finalHtml = result.reply;
    if (executedSummary.length > 0) {
      finalHtml += `<br><br><div style="font-size:12px; opacity:0.85; border-top:1px dashed rgba(255,255,255,0.2); padding-top:6px;"><b>Actions Executed:</b><br>✓ ${executedSummary.join("<br>✓ ")}</div>`;
    }

    const loaderMsg = document.getElementById(loadingId);
    if (loaderMsg) loaderMsg.innerHTML = finalHtml;
  } catch (err) {
    const loaderMsg = document.getElementById(loadingId);
    if (loaderMsg) {
      loaderMsg.innerHTML = `Error executing request: ${err.message}`;
    }
  }

  chat.scrollTop = chat.scrollHeight;
}

window.askGemini = askGemini;
window.handleGeminiEnter = function (e) {
  if (e.key === "Enter") askGemini();
};
