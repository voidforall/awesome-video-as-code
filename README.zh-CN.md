# Awesome Video as Code [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

<p align="center">
  <a href="assets/trailer.mp4"><img src="assets/trailer.gif" width="720" alt="预告片：agent 接收需求，编写可逐帧定位的 HTML 动画，再由无头 Chrome 逐帧渲染为视频"></a>
  <br>
  <sub>这段预告片本身就是 video as code：由 AI agent 写成<a href="trailer/index.html">一个 HTML 页面</a>，再用<a href="trailer/render.mjs">零依赖脚本</a>驱动无头 Chrome 和 FFmpeg 渲染。</sub>
</p>

> 精选用 AI agent 编写或指导代码来生成视频的工具、技能、生产管线、开源案例与研究。

[English](README.md) · **简体中文**

Video as code 把可执行代码当作视觉媒介：agent 编写 HTML、Canvas、SVG、React、TypeScript 或 Python，再由浏览器或渲染引擎生成视频。本列表关注这种可检查、可编程的工作流。只有当 agent 或管线设计对 video-as-code 实践有直接价值时，才会收录调用像素生成视频模型的工具。

## 目录

- [从这里开始](#从这里开始)
- [框架与渲染器](#框架与渲染器)
- [Agent 技能与工具](#agent-技能与工具)
- [MCP 服务与集成](#mcp-服务与集成)
- [生产管线](#生产管线)
- [开源案例](#开源案例)
- [研究](#研究)
- [学习资料](#学习资料)
- [相关列表](#相关列表)

## 从这里开始

| 如果你想…… | 从这里开始…… |
| --- | --- |
| 用普通 HTML、CSS 和 JavaScript 制作视频 | [框架与渲染器](#框架与渲染器) |
| 像编写 React 组件一样编排视频 | [框架与渲染器](#框架与渲染器) |
| 制作技术讲解或数学动画 | [框架与渲染器](#框架与渲染器) |
| 给 agent 安装专门的视频制作工作流 | [Agent 技能与工具](#agent-技能与工具) |
| 加入音频、字幕、素材或自动渲染 | [生产管线](#生产管线) |
| 从公开源码的完整项目中学习 | [开源案例](#开源案例) |

核心路径是 **brief → agent → 可执行视觉代码 → 确定性渲染器 → 视频文件**。生成式视频 API、素材拼接和录屏属于相邻路径，不是本列表的主要范围。

| 标签 | 含义 |
| --- | --- |
| **代码渲染** | 代码定义帧或场景图，再由浏览器或图形引擎生成像素。 |
| **混合管线** | 代码组合普通媒体素材，也可能选择性使用模型生成的素材。 |
| **基础设施** | 用于捕获、时间线、转录、编码或交付的配套工具。 |

## 框架与渲染器

- [Remotion](https://github.com/remotion-dev/remotion) - 基于 React 的代码渲染框架，包含 Studio、播放器和程序化视频渲染工具；采用 source-available 的 Remotion License。
- [HyperFrames](https://github.com/heygen-com/hyperframes) - 面向 HTML 视频的代码渲染框架，支持可 seek 动画适配器，以及基于 Chrome 和 FFmpeg 的确定性渲染。
- [Motion Canvas](https://github.com/motion-canvas/motion-canvas) - TypeScript 代码渲染框架与实时编辑器，适合制作与旁白同步的矢量讲解动画。
- [Manim Community](https://github.com/ManimCommunity/manim) - 用于精确制作数学和技术动画的 Python 代码渲染引擎。
- [Revideo](https://github.com/midrender/revideo) - TypeScript 代码渲染框架，提供参数化模板、播放器和面向视频应用的无头渲染。
- [MoviePy](https://github.com/Zulko/moviepy) - 用 Python 编写剪辑、合成、特效、标题和编码流程的混合媒体库。
- [p5.js](https://github.com/processing/p5.js) - 面向 Canvas 和 WebGL 的创意编程库，可由浏览器渲染器逐帧捕获。
- [Three.js](https://github.com/mrdoob/three.js) - 用于 WebGL 场景的 JavaScript 3D 引擎，可配合浏览器视频渲染器使用。

## Agent 技能与工具

- [Remotion Agent Skills](https://github.com/remotion-dev/skills) - Remotion 官方 agent 指令，覆盖构图、动画、音频、字幕、转场和渲染。
- [HyperFrames Skills](https://github.com/heygen-com/hyperframes/tree/main/skills) - HyperFrames 官方技能，覆盖规划、创作、检查、预览、编辑和渲染。
- [Claude Code Video Toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) - 结合 Remotion、FFmpeg、浏览器录制、转录、语音、音乐和生成素材的 agent 工作区。
- [Motion Skills](https://github.com/iart-ai/motion-skills) - 面向动态文字、讲解视频、数据可视化、短视频、WebGL 和 Manim 的可安装技能包。
- [Claude Motion Design](https://github.com/howseen-ai/claude-motion-design) - 使用 HTML 制作动效并通过 Playwright 和 FFmpeg 渲染的技能与示例。
- [Videowright](https://github.com/scosman/videowright) - 让 coding agent 根据结构化计划与版本控制素材制作动画讲解视频的工作流。

## MCP 服务与集成

- [Pireel](https://github.com/pireel/pireel) - 混合型时间线编辑器，其 agent 插件允许 MCP agent 编辑剪辑、字幕、图形、音频和导出，同时由人保留 GUI 控制。
- [OpenVidStudio](https://github.com/AnayDhawan/openvidstudio) - 用 Playwright 捕获真实应用，并通过 Remotion 合成产品演示的混合型 MCP 工作流。
- [mimic-mcp](https://github.com/pouyashahrdami/mimic-mcp) - 分析参考视频、从给定素材搭建 Remotion 项目、渲染并进行视觉复核的混合型 MCP 服务。
- [Blender MCP](https://github.com/ahujasid/mcp-for-blender) - 允许语言模型控制 Blender 场景并渲染传统 3D 动画的社区集成。

## 生产管线

- [FFmpeg](https://ffmpeg.org/) - 用于编码、封装、滤镜、音频混合、媒体探测和格式转换的基础工具。
- [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) - 面向剪辑时间线、片段、轨道、转场和适配器的交换格式与 API。
- [Whisper](https://github.com/openai/whisper) - 可为字幕工作流生成转录文本的语音识别模型与参考实现。
- [WhisperX](https://github.com/m-bain/whisperX) - 支持词级对齐和可选说话人分离的转录工具，适合精确字幕计时。
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) - 在浏览器中完成媒体转换与合成的 FFmpeg WebAssembly 移植版。

## 开源案例

本节项目会公开源码、prompt 或制作说明，使读者能够了解视频的实际制作方式。

- [PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) - 使用 p5.js 与 p5.brush 的代码渲染 MV，公开了源码、分镜、动画指南和浏览器渲染器。
- [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) - 基于 p5.js 的代码渲染起步项目，包含手绘角色、可复用的情绪表演和 coding agent 指令。
- [Lemo Opuscar](https://github.com/lemomo-ai/lemo-opuscar) - 代码制作的短片合集，并公开了可复用的视觉风格 prompt 和导演指导。
- [Zero to Product Video Hero](https://github.com/specstoryai/zero-to-product-video-hero) - 公开产品视频构图源码、成片、制作计划和 agent 对话的 Remotion 项目。

## 研究

- [Manimator: Transforming Research Papers into Visual Explanations](https://arxiv.org/abs/2507.14306) - 将论文或 prompt 转换为结构化场景和可执行 Manim 代码的两阶段系统。
- [Training and Agentic Inference Strategies for LLM-Based Manim Animation Generation](https://arxiv.org/abs/2604.18364) - 研究文本到 Manim 系统的监督训练、强化学习、渲染器反馈、文档检索和评测方法。
- [LLM2Manim: Pedagogy-Aware AI Generation of STEM Animations](https://arxiv.org/abs/2604.05266) - 使用受约束 prompt、符号一致性、局部重生成、旁白和专家复核的人机协同管线。
- [PhysicsSolutionAgent](https://arxiv.org/abs/2601.13453) - 生成多分钟 Manim 讲解，并通过定量规则和视觉模型反馈迭代检查的 agent。

## 学习资料

- [Remotion Documentation](https://www.remotion.dev/docs/) - 从创建 React 构图、使用 Remotion Studio 预览到渲染视频的官方入门文档。
- [Remotion Agent Skills Guide](https://www.remotion.dev/docs/ai/skills) - 介绍 Remotion 创作、编辑、渲染、字幕、多媒体和应用开发技能的官方指南。
- [HyperFrames Quickstart](https://hyperframes.heygen.com/quickstart) - 使用 agent 或手写代码创建并渲染确定性 HTML 构图的官方教程。
- [HyperFrames Prompt Guide](https://hyperframes.heygen.com/guides/prompting) - 关于撰写 brief、提供上下文、使用动效词汇迭代和避免常见错误的官方指南。
- [Motion Canvas Quickstart](https://motioncanvas.io/docs/quickstart/) - 关于场景、生成器函数、实时预览和渲染的官方入门教程。
- [Manim Example Gallery](https://docs.manim.community/en/stable/examples.html) - 把数学动画成片与对应 Python 源码并列展示的官方示例库。

## 相关列表

- [Awesome Opus 5.5 Videos](https://github.com/yihui-dev/awesome-opus5-5-videos) - 面向 Claude Opus 5.5 视频实验的模型专题画廊，收录 prompt、原始发布和在线复刻。
- [Awesome Claude 5.5 Videos](https://github.com/athemeroy/awesome-claude-5-5-videos) - 记录 prompt、工具、制作证据和模型版本的来源链接目录。
- [Awesome Creative Coding](https://github.com/terkelg/awesome-creative-coding) - 跨视觉媒介的创意编程工具、框架、书籍、教程和社区。
- [Awesome Web Animation](https://github.com/sergey-pimenov/awesome-web-animation) - 面向 SVG、CSS、Canvas、JavaScript 和 React 的浏览器动画库与学习资料。

## 参与贡献

欢迎贡献。提交资源前，请先阅读[贡献指南](contributing.md)。如果这个列表帮你省下了搜索时间，点个 star 能让更多人找到它。
