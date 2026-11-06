# Публикация в PROloggg/family-archive

Проект полностью подготовлен и закоммичен локально. Ветка main, remote origin — https://github.com/PROloggg/family-archive.git .

Попытка push6ноября2026 отклонена: сохранённый логин/токен GitHub недействителен. Браузерная сессия также не авторизована. Файлы на GitHub пока не отправлены, Pages не включён.

В PowerShell на этом компьютере выполните:

```powershell
git credential-manager github login --username PROloggg --force --browser
git -C 'C:\Users\prologgg\Desktop\дерево\проект-дерево' push -u origin main
```

Первая команда запускает повторный вход GitHub. Пароль/токен в чат передавать не нужно.

После успешного push откройте настройки репозитория:
https://github.com/PROloggg/family-archive/settings/pages

Выберите Deploy from a branch → main → / (root) → Save. После завершения сборки сайт должен быть доступен по адресу:
https://prologgg.github.io/family-archive/

index.html находится в корне. Все документы, фотографии, реестры, превью и остальные необходимые файлы включены в коммит. Установка зависимостей и сборка не нужны. Начальный масштаб —50%.

Официальная инструкция GitHub Pages:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
