# Guia de Primeiro Acesso - Gestcon Doctor

Siga estes passos para colocar o sistema em funcionamento pela primeira vez.

## Passo 1: Configurar o Banco de Dados (Supabase)

1. Acesse o painel do seu projeto no [Supabase](https://supabase.com/dashboard).
2. No menu lateral esquerdo, clique em **SQL Editor** (ícone de prompt `>_`).
3. Clique em **New Query**.
4. Copie todo o conteúdo do arquivo localizado em:  
   `c:\APP\Gestcon Doctor\docs\supabase_schema.sql`
5. Cole no editor do Supabase e clique no botão **Run** (ou pressione `Ctrl + Enter`).
6. Se aparecer "Success", suas tabelas de Médicos, Hospitais, Convênios e Tabelas de Preço foram criadas!

---

## Passo 2: Executar o Backend (API)

O backend é responsável por processar as regras de negócio e conectar ao banco.

1. Abra um terminal no diretório do projeto.
2. Navegue até a pasta backend:  
   ```powershell
   cd backend
   ```
3. No terminal do VS Code ou explorador de arquivos, abra o arquivo `backend/.env`.
4. Substitua `[YOUR-PASSWORD]` pela senha que você definiu ao criar o projeto no Supabase.
5. Inicie o servidor:  
   ```powershell
   uvicorn main:app --reload
   ```
5. Mantenha esta janela aberta. O backend estará rodando em `http://127.0.0.1:8000`.

---

## Passo 3: Executar o Frontend (Interface)

O frontend é onde você interage com o sistema.

1. Abra um **novo terminal** (não feche o do backend).
2. Navegue até a pasta frontend:  
   ```powershell
   cd frontend
   ```
3. Inicie o servidor de desenvolvimento:  
   ```powershell
   npm run dev
   ```
4. O terminal mostrará um link, geralmente `http://localhost:5173`. Clique nele ou abra no navegador.

---

## Passo 4: Criar seu Primeiro Usuário

1. Ao abrir o site, você verá a tela de **Login**.
2. Como é seu primeiro acesso, use o botão **Cadastrar**.
3. Insira seu e-mail e uma senha.
4. O Supabase enviará um e-mail de confirmação (verifique sua caixa de entrada ou SPAM).
5. Após confirmar o e-mail, você poderá fazer o **Login** e acessar o Dashboard do Gestcon Doctor!

---

## Notas para o Segundo PC

Quando for para o segundo computador:
1. Faça o `git pull` para baixar as últimas alterações.
2. Você **não** precisa rodar o script no Supabase novamente (o banco é o mesmo na nuvem).
3. Você precisará apenas rodar o passo 2 e 3 para ver o sistema.
