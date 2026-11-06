# Публикация семейного архива

Репозиторий: https://github.com/PROloggg/family-archive
Сайт: https://prologgg.github.io/family-archive/

6 ноября 2026 года проект с документами, фотографиями и всеми кандидатами отправлен в ветку main. GitHub Pages включён: источник — ветка main, папка / (root). index.html находится в корне; зависимости и сборка не нужны. Начальный масштаб дерева — 50%.

Для следующих обновлений в PowerShell:

```powershell
git -C 'C:\Users\prologgg\Desktop\дерево\проект-дерево' add --all
git -C 'C:\Users\prologgg\Desktop\дерево\проект-дерево' commit -m 'Update family archive'
git -C 'C:\Users\prologgg\Desktop\дерево\проект-дерево' push
```

После push GitHub Pages автоматически публикует изменения. Статус доступен в разделе Actions репозитория. Все 9 кандидатов показаны отдельно от установленных семейных карточек с предупреждением о неподтверждённом родстве.

Настройки Pages: https://github.com/PROloggg/family-archive/settings/pages
Официальная инструкция: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
