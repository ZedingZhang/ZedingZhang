# Zeding Zhang

I build coding-agent infrastructure, repository intelligence systems,
and deployable AI workflows with a bias toward reliability, auditability,
and deterministic verification.

## Current Focus

- Coding-agent safety: sandboxed execution, policy checks, audit trails, replayable artifacts
- Repository intelligence: code-aware retrieval, citations, MCP tools, approval-gated maintenance
- Local-first agent design: deterministic pipelines, BM25/AST retrieval, test-driven verification

## Featured Work

| Project | What it demonstrates | Status |
|---|---|---|
| [RepoAirlock](https://github.com/ZedingZhang/repoairlock) | Safety-oriented execution harness for coding agents: Docker isolation, policy enforcement, audit trails, patch replay, HTML reports | v0.1.1-alpha |
| [CodePipe](https://github.com/ZedingZhang/codepipe) | Deterministic local-first coding agent with a fixed expert pipeline, BM25 + AST retrieval, fuzzy patching, and pytest verification | v0.1.0-alpha |
| [RepoRAG](https://github.com/ZedingZhang/reporag) | Source-grounded repository RAG plus an approval-gated code maintenance workbench with LangGraph, MCP, and security guards | v0.1.0-alpha |
| [GEO Lens](https://github.com/ZedingZhang/geo-lens) | Production-style full-stack AI SaaS for GEO / AI-search visibility workflows | [Live Demo](https://geo-lens-peach.vercel.app) |

## Project Map

| Layer | Project | Purpose |
|---|---|---|
| Repository understanding | [RepoRAG](https://github.com/ZedingZhang/reporag) | Retrieve code context, answer with citations, expose MCP tools |
| Deterministic code editing | [CodePipe](https://github.com/ZedingZhang/codepipe) | Local-first repair pipeline with BM25/AST localization and pytest verification |
| Safe execution | [RepoAirlock](https://github.com/ZedingZhang/repoairlock) | Run coding agents in Docker with policy checks, audit logs, and replayable reports |
| Productization | [GEO Lens](https://github.com/ZedingZhang/geo-lens) | Full-stack AI SaaS demo for AI-search visibility workflows |
| Vision / edge AI | [DMS-MultiTask](https://github.com/ZedingZhang/dms-multitask) | Lightweight driver-monitoring model, TensorRT-ready |

## Additional Work

- [DMS-MultiTask](https://github.com/ZedingZhang/dms-multitask) — lightweight driver monitoring model with 1.14M parameters and TensorRT-ready deployment
- [VLM Data Closedloop](https://github.com/ZedingZhang/vlm-data-closedloop) — VLM-assisted hard-example mining, annotation, and augmentation pipeline for cabin monitoring
- [Huazhou Dictionary](https://github.com/ZedingZhang/huazhou-dictionary-miniprogram) — offline WeChat mini program for Huazhou dialect lookup with 4,310 entries
