# Custom Claims (role=admin) para o Painel

Este guia mostra como marcar um usuário como administrador (role=admin) no Firebase Auth, permitindo acesso ao Painel (`/admin/*`) e permissões ampliadas nas Regras do Firestore.

## Pré-requisitos
- Acesso ao projeto Firebase (mesmo projeto do app-frota)
- Baixar a **Service Account**: Firebase Console → Configurações do Projeto → Contas de serviço → Gerar nova chave privada.
- Salvar o JSON como `scripts/serviceAccountKey.json` (ou informe um caminho alternativo com `--key`).
- Node 18+ instalado.

## Script
Arquivo: `scripts/set-admin.mjs`

- Cria o usuário se não existir (opcional), atualiza a senha (se informada) e define a Custom Claim `role=admin`.
- Também revoga tokens para forçar o refresh na próxima sessão.

### Uso
```bash
# Dentro da raiz do projeto (onde está package.json)
node scripts/set-admin.mjs --email="gestor.frota@xingumaquinas.com" --password="xingu2025"
# Opcional: informar caminho da chave
node scripts/set-admin.mjs --email="..." --password="..." --key="C:/caminho/para/serviceAccountKey.json"
```

Saída esperada:
- Confirmação do UID e mensagem para refazer login.

## Regras do Firestore
A função `isAdmin()` usa a claim:
```groovy
function isAdmin() {
  return isAuthenticated() && request.auth.token.role == 'admin';
}
```
As regras já estão preparadas para liberar leitura/escrita para admin nas coleções `users`, `vehicles`, `refueling`, `maintenance`.

## Passo final
- O gestor precisa **sair e entrar novamente** no app/painel para receber o novo token contendo `role=admin`.
- Verifique acesso ao painel: `https://<seu-site>/admin`.
