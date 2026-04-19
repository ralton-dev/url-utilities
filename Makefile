SHELL := /bin/bash

REGISTRY         ?= ghcr.io/ralton-dev
IMAGE_NAME       ?= url-utilities
PLATFORMS        ?= linux/amd64
CHART_DIR        := deploy/helm/url-utilities
CHART_VALUES     := $(CHART_DIR)/values.yaml

VERSION          ?= $(shell git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo 0.0.0-dev)
SHORT_SHA        ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
TAG              ?= $(VERSION)-$(SHORT_SHA)
IMAGE            := $(REGISTRY)/$(IMAGE_NAME)

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-version
print-version: ## Print resolved version
	@echo $(VERSION)

.PHONY: print-tag
print-tag: ## Print image tag (<version>-<short-sha>)
	@echo $(TAG)

.PHONY: bump-version
bump-version: ## Bump Chart.yaml + values.yaml and create annotated tag (VERSION=x.y.z required)
	@if [ -z "$(VERSION_ARG)" ]; then echo "Usage: make bump-version VERSION_ARG=1.2.3"; exit 1; fi
	@sed -i.bak -E "s/^version:.*/version: $(VERSION_ARG)/" $(CHART_DIR)/Chart.yaml
	@sed -i.bak -E "s/^appVersion:.*/appVersion: '$(VERSION_ARG)'/" $(CHART_DIR)/Chart.yaml
	@sed -i.bak -E "s|(^  tag:).*|\1 'v$(VERSION_ARG)'|" $(CHART_VALUES)
	@rm -f $(CHART_DIR)/Chart.yaml.bak $(CHART_VALUES).bak
	@git add $(CHART_DIR)/Chart.yaml $(CHART_VALUES)
	@git commit -m "chore: release v$(VERSION_ARG)"
	@git tag -a "v$(VERSION_ARG)" -m "v$(VERSION_ARG)"
	@echo "Tagged v$(VERSION_ARG). Push with: git push origin main --tags"

.PHONY: build
build: ## Build a local single-arch image, load into the daemon
	docker build -t $(IMAGE):$(TAG) -t $(IMAGE):latest .

.PHONY: push
push: ## Push already-built image tags
	docker push $(IMAGE):$(TAG)
	docker push $(IMAGE):latest

.PHONY: buildx-push
buildx-push: ## Multi-arch build + push in one step
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(IMAGE):$(TAG) \
		--tag $(IMAGE):v$(VERSION) \
		--push .

.PHONY: helm-lint
helm-lint: ## Lint the Helm chart
	helm lint $(CHART_DIR) --set secrets.API_KEY=x --set secrets.POSTGRES_URL=x

.PHONY: helm-template
helm-template: ## Render the chart with dev values
	helm template dev $(CHART_DIR) --set secrets.API_KEY=x --set secrets.POSTGRES_URL=x

.PHONY: helm-install
helm-install: ## Install/upgrade release. Usage: make helm-install REPO=<slug>
	@if [ -z "$(REPO)" ]; then echo "Usage: make helm-install REPO=<slug>"; exit 1; fi
	helm upgrade --install url-utilities-$(REPO) $(CHART_DIR) \
		--namespace url-utilities-$(REPO) \
		--create-namespace \
		-f $(CHART_DIR)/values-$(REPO).yaml

.PHONY: helm-uninstall
helm-uninstall: ## Uninstall a release. Usage: make helm-uninstall REPO=<slug>
	@if [ -z "$(REPO)" ]; then echo "Usage: make helm-uninstall REPO=<slug>"; exit 1; fi
	helm uninstall url-utilities-$(REPO) --namespace url-utilities-$(REPO)
