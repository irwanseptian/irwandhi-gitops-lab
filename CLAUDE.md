# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a GitOps playground demonstrating a full CI/CD pipeline with Jenkins (CI) and ArgoCD (CD) deploying containerized applications to Kubernetes.

## Repository Structure

```
apps/           # Application source code and Dockerfiles
ci/             # Jenkins pipeline definitions (Jenkinsfile)
infra/
  argocd/       # ArgoCD installation/configuration manifests
  jenkins/      # Jenkins installation/configuration manifests
kubernetes/
  base/         # Kustomize base manifests (shared across environments)
  overlays/     # Kustomize environment-specific patches
    playground/ # Playground environment overlay
```

## Architecture

**CI flow (Jenkins):** Code push → Jenkinsfile pipeline → build Docker image → push to registry → update image tag in `kubernetes/` manifests.

**CD flow (ArgoCD):** ArgoCD watches this repo → detects manifest changes → syncs to Kubernetes cluster (GitOps pull model).

**Kubernetes manifests** use [Kustomize](https://kustomize.io/): `kubernetes/base/` holds the canonical resource definitions; `kubernetes/overlays/<env>/` patches environment-specific values (replicas, image tags, resource limits).

## Key Conventions

- Each application lives under `apps/<app-name>/` with its own `Dockerfile`.
- The `ci/Jenkinsfile` is the single pipeline entrypoint for all build/test/push stages.
- ArgoCD `Application` CRs and related configs belong in `infra/argocd/`.
- Jenkins infrastructure configs (JCasC, helm values, etc.) belong in `infra/jenkins/`.
- Environment promotion is done by updating the image tag in the appropriate `kubernetes/overlays/<env>/` kustomization, not by branching.
