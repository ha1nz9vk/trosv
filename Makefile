COMPOSE ?= docker compose

.DEFAULT_GOAL := help

.PHONY: help up down logs test-api lint-api lint-web build-web test-e2e smoke backup check

help: ## Hien thi danh sach cac target kha dung
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'

up: ## Khoi dong stack container o che do nen
	$(COMPOSE) up -d

down: ## Dung cac container (giu nguyen volumes va du lieu)
	$(COMPOSE) down

logs: ## Xem log he thong theo thoi gian thuc
	$(COMPOSE) logs -f

test-api: ## Chay kiem thu Laravel API trong backend container (su dung DB rental_test)
	@if ! $(COMPOSE) exec -T backend true 2>/dev/null; then \
		echo "Loi: Container 'backend' khong chay. Vui long chay 'make up' truoc khi chay 'make test-api'." >&2; \
		exit 1; \
	fi
	@echo "Targeting DB: rental_test"
	$(COMPOSE) exec -T -e DB_DATABASE=rental_test -e APP_ENV=testing -e CACHE_STORE=array -e BCRYPT_ROUNDS=4 -e TRUSTED_PROXIES="" backend php -r "require 'vendor/autoload.php'; \$$app = require 'bootstrap/app.php'; \$$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo 'Database: ' . config('database.connections.pgsql.database') . PHP_EOL;"
	$(COMPOSE) exec -T -e DB_DATABASE=rental_test -e APP_ENV=testing -e CACHE_STORE=array -e BCRYPT_ROUNDS=4 -e TRUSTED_PROXIES="" backend php artisan test

lint-api: ## Kiem tra code style backend voi Pint
	cd apps/api && ./vendor/bin/pint --test

lint-web: ## Kiem tra linting frontend voi ESLint
	npm --prefix apps/web run lint

build-web: ## Bien dich frontend SPA cho production
	npm --prefix apps/web run build

test-e2e: ## Chay kiem thu giao dien E2E Playwright
	cd apps/web && npx playwright test

smoke: ## Chay bo kiem thu smoke test API va quy trinh nghiep vu
	bash apps/web/e2e-smoke.sh

backup: ## Chay sao luu database va storage volume vao thu muc backups
	bash infra/backup/backup.sh

check: lint-api test-api lint-web build-web ## Chay toan bo cac buoc kiem tra (lint-api, test-api, lint-web, build-web)
