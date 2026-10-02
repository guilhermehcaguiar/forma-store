# FORMA

Loja de camisas oversized masculinas. Este repositório contém o front-end do
projeto, desenvolvido como atividade acadêmica e construído por etapas durante
as aulas.

## Objetivo

Criar a base de um e-commerce simples, com navegação entre páginas e a
estrutura inicial de catálogo, carrinho e autenticação. Nesta etapa o foco é a
organização do código e o layout básico, sem integração com back-end.

## Tecnologias utilizadas

- [React](https://react.dev/) 19
- [Vite](https://vite.dev/) 8
- [React Router](https://reactrouter.com/) 7 (`react-router-dom`)
- [Oxlint](https://oxc.rs/) para lint

## Funcionalidades desta entrega

- Navegação entre as páginas Home, Catálogo, Sobre Nós, Carrinho e
  Login/Cadastro.
- Componentes reutilizáveis: cabeçalho, menu de navegação, rodapé e botão.
- Home com o nome **FORMA**, uma breve apresentação e botão para o catálogo.
- Catálogo iniciado com um array vazio e a mensagem
  "Nenhum produto cadastrado ainda".
- Carrinho vazio com mensagem e link para voltar ao catálogo.
- Página Sobre Nós com um texto curto.
- Formulários visuais de login e cadastro, ainda sem autenticação real.

## Instalação e execução

Pré-requisito: Node.js e npm instalados.

```bash
# instalar as dependências
npm install

# rodar o servidor de desenvolvimento
npm run dev

# gerar a build de produção
npm run build

# pré-visualizar a build de produção
npm run preview

# rodar o lint
npm run lint
```

Após `npm run dev`, o site fica disponível no endereço exibido no terminal
(por padrão, `http://localhost:5173`).

## Estrutura do projeto

```
.
├── index.html
├── package.json
├── vite.config.js
└── src
    ├── App.jsx           # definição das rotas
    ├── main.jsx          # ponto de entrada e BrowserRouter
    ├── components        # Header, NavMenu, Footer, Button
    ├── data              # products.js (array vazio por enquanto)
    ├── pages             # Home, Catalog, About, Cart, Auth
    └── styles            # global.css
```

## Identidade visual

O layout atual é simples e será refinado conforme os mockups do projeto. A
paleta prevista é:

- `#E9F1FA` — fundo
- `#00ABE4` — cor de destaque
- `#FFFFFF` — superfícies

## Próximas etapas (planejadas)

Os itens abaixo ainda **não** estão implementados e serão adicionados nas
próximas entregas:

- Cadastro de produtos e imagens.
- Filtros e ordenação do catálogo.
- Favoritos e lista de compras.
- Perfil do usuário e endereços.
- Cupons de desconto.
- Checkout com cadastro obrigatório.
- Integração com Mercado Pago e cálculo de frete.
- Envio de e-mails.
- Painel administrativo.

A infraestrutura prevista para essas etapas utiliza Supabase e Vercel.
