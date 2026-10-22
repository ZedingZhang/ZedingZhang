# [![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=26&duration=3500&pause=1000&color=58A6FF&width=650&height=40&lines=Hi!+I'm+Zeding+Zhang.)](https://git.io/typing-svg)

I focus on agent development, agent safety, and edge inference.

## Contribution Activity

<p align="center">
  <a href="https://zeding-github-activity-graph.vercel.app">
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcset="https://zeding-github-activity-graph.vercel.app/graph?theme=dark"
      />
      <source
        media="(prefers-color-scheme: light)"
        srcset="https://zeding-github-activity-graph.vercel.app/graph?theme=light"
      />
      <img
        alt="Zeding Zhang's GitHub contribution activity graph"
        src="https://zeding-github-activity-graph.vercel.app/graph?theme=light"
      />
    </picture>
  </a>
</p>

## Open Source Contributions

<!--OPEN_SOURCE_CONTRIBUTIONS:start-->

40 merged PRs across 18 upstream projects.

| Project | Merged | What the PRs cover | Highlight fixes |
|---------|:------:|--------------------|-----------------|
| [Agent Swarm](https://github.com/desplega-ai/agent-swarm) (925★) | **12** | Agent runtime reliability: MCP setup retries, worker readiness, credential checks, and configurable script execution | [#2090](https://github.com/desplega-ai/agent-swarm/pull/2090) Retry transient MCP setup failures before a Pi session loses its swarm tools.<br>[#1981](https://github.com/desplega-ai/agent-swarm/pull/1981) Validate ACP targets and commands before workers claim tasks they cannot start.<br>[#2037](https://github.com/desplega-ai/agent-swarm/pull/2037) Make the QuickJS worker pool configurable, with validated concurrency limits. |
| [MNN](https://github.com/alibaba/MNN) (16.3k★) | **4** | Edge LLM inference and export: Omni request state, attention masks, AWQ calibration, and QNN embeddings | [#4894](https://github.com/alibaba/MNN/pull/4894) Refresh stale PLE inputs between successive Omni text requests while preserving multimodal inputs.<br>[#4888](https://github.com/alibaba/MNN/pull/4888) Route Omni attention masks by generation or embedding mode to avoid rank-0 mask crashes.<br>[#4555](https://github.com/alibaba/MNN/pull/4555) Correct embedding model filenames and tensor IO in QNN export. |
| [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) (14.3k★) | **3** | Agent orchestration correctness: multimodal handoff preservation and explicit mode validation | [#8551](https://github.com/microsoft/agent-framework/pull/8551) Preserve user images, files, and vector-store references during agent handoffs.<br>[#8536](https://github.com/microsoft/agent-framework/pull/8536) Reject explicitly empty mode lists instead of silently falling back to built-in modes. |
| [NullAway](https://github.com/uber/NullAway) (4.1k★) | **3** | Java null-safety analysis: constructor initialization checks, Maven-injected fields, and GitHub Actions security auditing | [#1929](https://github.com/uber/NullAway/pull/1929) Prevent initialization-check crashes in `@NullMarked` constructors inside unmarked classes.<br>[#1848](https://github.com/uber/NullAway/pull/1848) Treat Maven `@Parameter` fields as externally initialized, avoiding false diagnostics. |
| [nanobot](https://github.com/HKUDS/nanobot) (49.3k★) | **2** | Agent provider compatibility and messaging: DeepSeek reasoning semantics and Discord reply support | [#6132](https://github.com/HKUDS/nanobot/pull/6132) Normalize DeepSeek minimal reasoning effort to low so thinking and tool-call history stay consistent.<br>[#5800](https://github.com/HKUDS/nanobot/pull/5800) Add opt-in Discord replies for regular, attachment, and streaming responses. |
| [Qwen Code](https://github.com/QwenLM/qwen-code) (28.6k★) | **2** | Managed-agent API error handling for missing tool publications | [#13602](https://github.com/QwenLM/qwen-code/pull/13602) Return a consistent 404 for unknown tool publications instead of an internal server error. |
| [Core ML Tools](https://github.com/apple/coremltools) (5.4k★) | **2** | Model conversion correctness: scalar squeeze values and symbolic upsample output shapes | [#2840](https://github.com/apple/coremltools/pull/2840) Preserve known upsample dimensions so symbolic 1D interpolation followed by Conv1d converts correctly.<br>[#2862](https://github.com/apple/coremltools/pull/2862) Normalize scalar squeeze results to the MIL input dtype. |
| [Reticle](https://github.com/reticlehq/reticle) (1.3k★) | **2** | Browser verification and setup: expected-failure signals and automatic plain HTML integration | [#1488](https://github.com/reticlehq/reticle/pull/1488) Recognize explicit refusal signals when an expected failure is the correct application outcome.<br>[#1466](https://github.com/reticlehq/reticle/pull/1466) Automatically connect plain HTML projects with package.json while preserving CSP edits. |
| [celery](https://github.com/celery/celery) (29.0k★) | **1** | test: assert exact task replacement nesting levels | [#10925](https://github.com/celery/celery/pull/10925) test: assert exact task replacement nesting levels |
| [Filament](https://github.com/google/filament) (20.6k★) | **1** | Vulkan depth/stencil render-target capability detection | [#10424](https://github.com/google/filament/pull/10424) Query the depth/stencil attachment feature bit when checking Vulkan format support. |
| [React Spectrum](https://github.com/adobe/react-spectrum) (16.0k★) | **1** | Calendar year-picker correctness at constrained date-range boundaries | [#10536](https://github.com/adobe/react-spectrum/pull/10536) Include the final selectable year and clamp its focused date to the allowed range. |
| [CubeSandbox](https://github.com/TencentCloud/CubeSandbox) (13.0k★) | **1** | OpenAI Agents SDK integration documentation in English and Chinese | [#1386](https://github.com/TencentCloud/CubeSandbox/pull/1386) Document OpenAI Agents SDK integration and migration from E2B Cloud to CubeSandbox. |
| [AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) (6.9k★) | **1** | Vulnerability-rule consistency across case-sensitive and case-insensitive filesystems | [#569](https://github.com/Tencent/AI-Infra-Guard/pull/569) Remove duplicate rules with case-colliding paths and reject future collisions in validation. |
| [PyRIT](https://github.com/microsoft/PyRIT) (4.7k★) | **1** | Accessibility of selected configuration paths in the AI red-teaming interface | [#2643](https://github.com/microsoft/PyRIT/pull/2643) Improve selected configuration-path contrast in both light and dark themes. |
| [fastjson2](https://github.com/alibaba/fastjson2) (4.4k★) | **1** | Dynamic ClassLoader isolation when multiple fastjson2 copies coexist | [#7873](https://github.com/alibaba/fastjson2/pull/7873) Keep generated writers in the current fastjson2 type universe when the context ClassLoader loads another copy. |
| [OSV.dev](https://github.com/google/osv.dev) (3.0k★) | **1** | Vulnerability severity-source attribution on detail pages | [#5933](https://github.com/google/osv.dev/pull/5933) Display severity sources so users can distinguish NVD, CNA, and self-attributed assessments. |
| [ONNX Runtime GenAI](https://github.com/microsoft/onnxruntime-genai) (1.1k★) | **1** | C# chat-client access to the cached generation state | [#2475](https://github.com/microsoft/onnxruntime-genai/pull/2475) Expose the cached Generator through IChatClient.GetService for between-request operations such as RewindTo. |
| [cuOpt](https://github.com/NVIDIA/cuopt) (1.1k★) | **1** | Quickstart documentation link maintenance | [#1925](https://github.com/NVIDIA/cuopt/pull/1925) Replace broken NVIDIA Brev documentation links in the Python and server quickstarts. |

<details>
<summary>All 12 merged Agent Swarm PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#2306](https://github.com/desplega-ai/agent-swarm/pull/2306) | perf(worker): cut boot API calls with a skills bundle |
| [#2298](https://github.com/desplega-ai/agent-swarm/pull/2298) | fix(codex): keep session instructions out of AGENTS.md |
| [#2281](https://github.com/desplega-ai/agent-swarm/pull/2281) | fix(github): parse boolean configuration flags consistently |
| [#2257](https://github.com/desplega-ai/agent-swarm/pull/2257) | fix(workflows): recover waits resolved before a crash |
| [#2220](https://github.com/desplega-ai/agent-swarm/pull/2220) | fix(fs): preserve file metadata on agent-fs uploads |
| [#2166](https://github.com/desplega-ai/agent-swarm/pull/2166) | fix(scripts): respect API PORT in script SDK defaults |
| [#2111](https://github.com/desplega-ai/agent-swarm/pull/2111) | feat(scripts): support zod/mini imports |
| [#2090](https://github.com/desplega-ai/agent-swarm/pull/2090) | fix(pi): retry swarm MCP setup before dropping tools |
| [#2037](https://github.com/desplega-ai/agent-swarm/pull/2037) | feat(scripts): make the QuickJS worker pool size configurable |
| [#2004](https://github.com/desplega-ai/agent-swarm/pull/2004) | feat(config): expose script executor selection in dashboard |
| [#1981](https://github.com/desplega-ai/agent-swarm/pull/1981) | fix(acp): validate target configuration before claiming tasks |
| [#1960](https://github.com/desplega-ai/agent-swarm/pull/1960) | fix(credentials): honor pi and opencode presence-only credentials |

</details>

<details>
<summary>All 4 merged MNN PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#4894](https://github.com/alibaba/MNN/pull/4894) | \[LLM:Bugfix\] Refresh PLE for successive Omni text requests |
| [#4888](https://github.com/alibaba/MNN/pull/4888) | \[LLM:Bugfix\] Route Omni attention masks by mode |
| [#4806](https://github.com/alibaba/MNN/pull/4806) | \[LLM:Bugfix\] Pass calibration input IDs to AWQ position IDs |
| [#4555](https://github.com/alibaba/MNN/pull/4555) | \[LLM:Bugfix\] Fix embedding QNN export paths |

</details>

<details>
<summary>All 3 merged Microsoft Agent Framework PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#9269](https://github.com/microsoft/agent-framework/pull/9269) | .NET: Preserve caller cancellation in memory providers |
| [#8551](https://github.com/microsoft/agent-framework/pull/8551) | Python: fix(orchestrations): preserve user multimodal content during handoff |
| [#8536](https://github.com/microsoft/agent-framework/pull/8536) | Python: Reject empty available\_modes in mode helpers |

</details>

<details>
<summary>All 3 merged NullAway PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#1929](https://github.com/uber/NullAway/pull/1929) | Avoid initialization-check crashes in `@NullMarked` constructors |
| [#1848](https://github.com/uber/NullAway/pull/1848) | Treat Maven plugin parameters as externally initialized |
| [#1816](https://github.com/uber/NullAway/pull/1816) | Set up zizmor-action |

</details>

<details>
<summary>All 2 merged nanobot PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#6132](https://github.com/HKUDS/nanobot/pull/6132) | fix(deepseek): map minimal reasoning effort to low |
| [#5800](https://github.com/HKUDS/nanobot/pull/5800) | feat(discord): add replyToMessage parity with Telegram |

</details>

<details>
<summary>All 2 merged Qwen Code PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#14636](https://github.com/QwenLM/qwen-code/pull/14636) | test(cli): retry ENOTEMPTY in hosted harness teardowns |
| [#13602](https://github.com/QwenLM/qwen-code/pull/13602) | fix(managed-agent): return 404 for unknown tool publications |

</details>

<details>
<summary>All 2 merged Core ML Tools PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#2862](https://github.com/apple/coremltools/pull/2862) | Fix squeeze value inference for scalar outputs |
| [#2840](https://github.com/apple/coremltools/pull/2840) | Fix symbolic nearest1d upsample output rank |

</details>

<details>
<summary>All 2 merged Reticle PRs</summary>

| PR | What changed |
|:--:|--------------|
| [#1488](https://github.com/reticlehq/reticle/pull/1488) | fix(engine): recognize refusal signals on expected failures |
| [#1466](https://github.com/reticlehq/reticle/pull/1466) | fix(init): wire plain HTML projects with package.json |

</details>

<details>
<summary>All 1 merged celery PR</summary>

| PR | What changed |
|:--:|--------------|
| [#10925](https://github.com/celery/celery/pull/10925) | test: assert exact task replacement nesting levels |

</details>

<details>
<summary>All 1 merged Filament PR</summary>

| PR | What changed |
|:--:|--------------|
| [#10424](https://github.com/google/filament/pull/10424) | vulkan: fix depth/stencil format support query |

</details>

<details>
<summary>All 1 merged React Spectrum PR</summary>

| PR | What changed |
|:--:|--------------|
| [#10536](https://github.com/adobe/react-spectrum/pull/10536) | fix: include final constrained year in CalendarYearPicker |

</details>

<details>
<summary>All 1 merged CubeSandbox PR</summary>

| PR | What changed |
|:--:|--------------|
| [#1386](https://github.com/TencentCloud/CubeSandbox/pull/1386) | docs(integrations): add OpenAI Agents SDK guide |

</details>

<details>
<summary>All 1 merged AI-Infra-Guard PR</summary>

| PR | What changed |
|:--:|--------------|
| [#569](https://github.com/Tencent/AI-Infra-Guard/pull/569) | fix(data): prevent recurring case-colliding vulnerability rules |

</details>

<details>
<summary>All 1 merged PyRIT PR</summary>

| PR | What changed |
|:--:|--------------|
| [#2643](https://github.com/microsoft/PyRIT/pull/2643) | FIX: Improve selected configuration path contrast |

</details>

<details>
<summary>All 1 merged fastjson2 PR</summary>

| PR | What changed |
|:--:|--------------|
| [#7873](https://github.com/alibaba/fastjson2/pull/7873) | fix: use own ClassLoader as parent when the context ClassLoader loads a foreign fastjson2 |

</details>

<details>
<summary>All 1 merged OSV.dev PR</summary>

| PR | What changed |
|:--:|--------------|
| [#5933](https://github.com/google/osv.dev/pull/5933) | fix(website): display severity source |

</details>

<details>
<summary>All 1 merged ONNX Runtime GenAI PR</summary>

| PR | What changed |
|:--:|--------------|
| [#2475](https://github.com/microsoft/onnxruntime-genai/pull/2475) | \[C#\] Expose cached Generator through IChatClient.GetService |

</details>

<details>
<summary>All 1 merged cuOpt PR</summary>

| PR | What changed |
|:--:|--------------|
| [#1925](https://github.com/NVIDIA/cuopt/pull/1925) | docs: update NVIDIA Brev documentation links |

</details>

<details>
<summary>Open PRs (19)</summary>

| Project | PR | What I'm working on |
|---------|:--:|---------------------|
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#15178](https://github.com/QwenLM/qwen-code/pull/15178) | feat(agents): make default background execution configurable |
| [lexical](https://github.com/facebook/lexical) | [#9414](https://github.com/facebook/lexical/pull/9414) | \[lexical-markdown\] Bug Fix: Treat the backslash as ASCII punctuation in emphasis flanking |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#14985](https://github.com/QwenLM/qwen-code/pull/14985) | fix(daemon): give the ACP initialize handshake its own startup budget |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#14982](https://github.com/QwenLM/qwen-code/pull/14982) | fix(core): make the always-on context warning accurate for CJK and actionable |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#14844](https://github.com/QwenLM/qwen-code/pull/14844) | fix(cli): prefer the user's global npm on Windows |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#14824](https://github.com/QwenLM/qwen-code/pull/14824) | fix(review): refuse the findings artifact by name and print the expected schema |
| [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | [#9543](https://github.com/microsoft/agent-framework/pull/9543) | Python: Handle missing reasoning text in DevUI |
| [nanobot](https://github.com/HKUDS/nanobot) | [#6194](https://github.com/HKUDS/nanobot/pull/6194) | fix(api): release idle session locks |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#14026](https://github.com/QwenLM/qwen-code/pull/14026) | refactor(cli): share compression token count formatting |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | [#13954](https://github.com/QwenLM/qwen-code/pull/13954) | fix(ci): enforce Flyway migration ordering |
| [swarms](https://github.com/kyegomez/swarms) | [#2522](https://github.com/kyegomez/swarms/pull/2522) | \[FIX\]\[MajorityVoting\]\[Respect verbose for panels\] |
| [workers-sdk](https://github.com/cloudflare/workers-sdk) | [#16090](https://github.com/cloudflare/workers-sdk/pull/16090) | \[deploy-helpers\] Add result-only output for Preview deployments |
| [volclava](https://github.com/bytedance/volclava) | [#119](https://github.com/bytedance/volclava/pull/119) | fix: preserve askedHosts for submit request cleanup |
| [OSV.dev](https://github.com/google/osv.dev) | [#6102](https://github.com/google/osv.dev/pull/6102) | fix(website): collapse long affected range event lists |
| [nanobot](https://github.com/HKUDS/nanobot) | [#5826](https://github.com/HKUDS/nanobot/pull/5826) | perf(session): accelerate canonical history search with FTS5 |
| [React Spectrum](https://github.com/adobe/react-spectrum) | [#10604](https://github.com/adobe/react-spectrum/pull/10604) | fix: support custom focus targets in DateRangePicker |
| [volclava](https://github.com/bytedance/volclava) | [#90](https://github.com/bytedance/volclava/pull/90) | fix: select RPC and NIS build dependencies by platform |
| [lexical](https://github.com/facebook/lexical) | [#9106](https://github.com/facebook/lexical/pull/9106) | \[lexical\]\[lexical-clipboard\]\[lexical-code-core\]\[lexical-code-prism\]\[lexical-code-shiki\]\[lexical-eslint-plugin\]\[lexical-extension\]\[lexical-list\]\[lexical-playground\]\[lexical-react\]\[lexical-table\] Feature: flag accidental nested editor updates |
| [aws-cdk](https://github.com/aws/aws-cdk) | [#38698](https://github.com/aws/aws-cdk/pull/38698) | docs(core): document special construct IDs |

</details>

<!--OPEN_SOURCE_CONTRIBUTIONS:end-->
