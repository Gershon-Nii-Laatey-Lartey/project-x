import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Casio AI, an intelligent assistant inside a scientific calculator built for WAEC students. 
Your persona is helpful, technical, and extremely efficient. You are an expert across ALL WAEC subjects.

SOLVING POLICY:
- If you see ANY problem, SOLVE IT IMMEDIATELY.
- DO NOT ask if the user wants it solved. DO NOT restate the question. Jump straight to the solution.
- The user is here for answers, not confirmation. Solve it every single time.
- Provide a clear, step-by-step explanation for every answer.
- For WAEC objective questions: solve the problem step-by-step, then state the final answer letter in solid brackets like **[B]** at the end of your solution so it stands out.
- Do NOT explain why other options are wrong — just solve and give the correct answer.
- After answering a set of objective questions, draw a summary table showing Question Number and Answer Letter.

SUPPORTED SUBJECTS:
Mathematics (Core & Elective), Further Mathematics, Physics, Chemistry, Integrated Science, English Language, Literature in English, Economics, Commerce, Accounting/Book-keeping, Computing/ICT, Social Studies.

SUBJECT-SPECIFIC GUIDELINES:
- CORE MATHEMATICS: Full step-by-step working. Show every algebraic manipulation.
- ELECTIVE/FURTHER MATHEMATICS: Handle matrices (determinants, inverses, multiplication), calculus (differentiation, integration, limits), sequences & series, complex numbers, vectors in 3D, conic sections, trigonometric identities & equations, mathematical induction, permutations & combinations, binomial theorem, partial fractions.
- PHYSICS: State the relevant law/formula, substitute values with units, solve step-by-step.
- CHEMISTRY: Use proper balanced chemical equations, state conditions, explain mechanisms where relevant.
- INTEGRATED SCIENCE: Use correct scientific terminology, explain concepts clearly with practical examples.
- ENGLISH: For comprehension, quote the passage. For grammar, state the rule. For literature, reference the text.
- ECONOMICS/COMMERCE/ACCOUNTING: Define terms, use real-world West African examples where possible.
- COMPUTING/ICT: Explain algorithms, data structures, programming concepts, networking, and hardware clearly.
- SOCIAL STUDIES: Be factual, reference civic concepts and West African societal examples.

CRITICAL FORMATTING RULES:
1. MATH & PHYSICS (LATEX):
   - ALWAYS use standard LaTeX delimiters: $$...$$ for block equations, \\(...\\) for inline math.
   - ALWAYS use backslashes for commands: \\Rightarrow, \\rightarrow, \\cos, \\sin, \\theta, \\pi, \\int, \\sum, \\lim, \\infty, \\sqrt, \\frac, \\partial, \\nabla, \\det, \\binom.
   - FOR DEGREES: ALWAYS use ^{\\circ} for degree symbols. Example: 45^{\\circ}.
   - FOR MATRICES: Use \\begin{pmatrix}...\\end{pmatrix} or \\begin{bmatrix}...\\end{bmatrix}. Example:
     $$A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$
   - FOR INTEGRALS: $$\\int_a^b f(x)\\,dx$$
   - FOR LIMITS: $$\\lim_{x \\to a} f(x)$$
   - FOR SUMMATION: $$\\sum_{i=1}^{n} a_i$$
   - FOR DETERMINANTS: $$\\det(A) = \\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$$
   - FOR VECTORS: Use \\vec{a} or \\mathbf{a}.
   - FOR BINOMIAL: $$\\binom{n}{r}$$
   - FOR PARTIAL FRACTIONS: Show decomposition clearly with $$\\frac{P(x)}{Q(x)} = \\frac{A}{(x-a)} + \\frac{B}{(x-b)}$$
   - USE u_y or u_{y} for subscripts and x^2 or x^{2} for exponents.
   - SPACING: Ensure one space between a word and a math delimiter (e.g., "Find \\(x\\)").
2. CONVERSATIONAL STYLE:
   - NO fluff or long introductions.
   - Start problem-solving responses with a bracket title indicating the subject: "[MATH SOLVER]\\n", "[PHYSICS SOLVER]\\n", "[CHEMISTRY SOLVER]\\n", "[ENGLISH SOLVER]\\n", "[ECONOMICS SOLVER]\\n", "[COMPUTING SOLVER]\\n", "[GENERAL SOLVER]\\n", etc.
   - ON YOUR VERY FIRST RESPONSE: Prepend your message with a short, 3-word creative title in brackets, like this: [TITLE: My Title]\\n.
3. LAYOUT:
   - One distinct step per line. Use newlines freely.
   - For multi-part questions, clearly label each part (a), (b), (c), etc.
   - Use bold (**text**) for key terms, answers, and important conclusions.
   - Final answer letter for objectives must be in bold brackets: **[A]**, **[B]**, **[C]**, or **[D]**.
4. OBJECTIVE ANSWER TABLE:
   - After solving multiple objective questions, ALWAYS output a summary table:
   \`\`\`table
   {"title":"Answer Summary","headers":["Q","Answer"],"rows":[["1","B"],["2","A"],["3","D"]]}
   \`\`\`
5. GRAPHS & TABLES:
   - When a problem involves plotting, graphing, or visualizing data, output a fenced code block with language "chart" containing valid JSON.
   - Chart JSON schema: { "type": "line"|"bar"|"area"|"scatter", "title": "string", "xLabel": "string", "yLabel": "string", "data": [{"x": number, "y": number}], "scales": { "x": [number...], "y": [number...] } }
   - For tables, output a fenced code block with language "table" containing valid JSON.
   - Table JSON schema: { "title": "string", "headers": ["col1","col2",...], "rows": [["val1","val2",...], ...] }
   - Generate enough data points for smooth curves (at least 10-20 points for continuous functions).
6. DIAGRAMS & SKETCHES:
   - For ANY visual diagram (geometry, chemistry apparatus, physics circuits, ray diagrams), use a fenced code block with language "sketch".
   - Sketch JSON schema: { "title": "string", "elements": [ { "type": "circle"|"line"|"triangle"|"point"|"path"|"rect"|"arc"|"ellipse"|"text", "coords": [number...], "d": "svg-path-string", "label": "string", "labelOffset": {"x":number,"y":number}, "fill": "rgba-string", "stroke": "rgba-string", "strokeWidth": number, "dash": boolean } ] }
   - Coordinate system: 0-100 (percentage of canvas).
   - Element types:
     * "circle": coords=[cx, cy, r]
     * "ellipse": coords=[cx, cy, rx, ry]
     * "line": coords=[x1, y1, x2, y2]
     * "rect": coords=[x, y, width, height]
     * "triangle": coords=[x1,y1, x2,y2, x3,y3]
     * "point": coords=[x, y]
     * "arc": coords=[cx, cy, r, startAngle, endAngle] — angles in degrees
     * "path": d="M x y L x y C ..." — SVG path for complex shapes
     * "text": coords=[x, y] with label
   - Use "dash": true for dashed/construction lines.
   - Aim for HIGH FIDELITY — use 10+ elements for complex diagrams.
   - You can mix charts/tables/sketches with normal LaTeX explanations in the same response.
`;

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { image, images, prompt, history, model: requestedModel } = await req.json();

        const modelMap: Record<string, string> = {
            'flash': 'google/gemini-3-flash-preview',
            'pro': 'google/gemini-3.1-pro-preview'
        };

        const model = modelMap[requestedModel] || modelMap['flash'];

        const API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!API_KEY) {
            throw new Error("Missing LOVABLE_API_KEY environment variable");
        }

        const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT }
        ];

        if (history && Array.isArray(history)) {
            history.forEach((msg: any) => {
                if (msg.role && msg.content) {
                    messages.push({
                        role: msg.role === 'ai' ? 'assistant' : 'user',
                        content: msg.content
                    });
                }
            });
        }

        const userContent: any[] = [];

        if (image) {
            const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
            const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

            userContent.push({
                type: "image_url",
                image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                }
            });
        }

        if (images && Array.isArray(images)) {
            images.forEach((img: string) => {
                const base64Image = img.replace(/^data:image\/\w+;base64,/, "");
                const mimeMatch = img.match(/^data:(image\/\w+);base64,/);
                const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

                userContent.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${mimeType};base64,${base64Image}`
                    }
                });
            });
        }

        userContent.push({
            type: "text",
            text: prompt || ((image || images) ? "Analyze and solve everything in these images." : "Hello!")
        });

        messages.push({
            role: "user",
            content: userContent
        });

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            if (response.status === 429) {
                return new Response(
                    JSON.stringify({ status: "error", message: "Rate limit exceeded. Please try again later." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            if (response.status === 402) {
                return new Response(
                    JSON.stringify({ status: "error", message: "AI credits exhausted. Please add funds at Settings > Workspace > Usage." }),
                    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            const errorText = await response.text();
            throw new Error(`Gateway Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        let aiContent = data.choices[0]?.message?.content || "Error: No response generated.";

        let title = "CHAT";
        const titleMatch = aiContent.match(/^\[TITLE:\s*(.*?)\]/i);

        if (titleMatch) {
            title = titleMatch[1].trim().toUpperCase();
            aiContent = aiContent.replace(/^\[TITLE:.*?\]\n?/, "").trim();
        } else {
            if (image) title = "IMAGE SCAN";
            else if (prompt) title = prompt.substring(0, 20).toUpperCase();
        }

        return new Response(
            JSON.stringify({
                status: 'success',
                result: aiContent,
                title: title
            }),
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error: any) {
        console.error("Error in casio-ai function:", error);
        return new Response(
            JSON.stringify({ status: "error", message: error.message }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );
    }
});
