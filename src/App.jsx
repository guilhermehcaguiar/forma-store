import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import RequireRole from './components/RequireRole'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import About from './pages/About'
import Cart from './pages/Cart'
import Auth from './pages/Auth'
import Account from './pages/Account'
import AccountLayout from './pages/account/AccountLayout'
import Overview from './pages/account/Overview'
import { Favorites, FavoritesPage, Orders, OrderDetail, Cards } from './pages/account/Collections'
import Addresses from './pages/account/Addresses'
import Lists, { ListDetail } from './pages/account/Lists'
import Checkout from './pages/Checkout'
import Product from './pages/Product'
import Administration, { AdminOverview, AdminProducts, AdminSection } from './pages/Administration'

function App() {
  return (
    <div className="app">
      <Header />
      <main className="main container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/carrinho" element={<Cart />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/cadastro" element={<Auth />} />
          <Route path="/produto" element={<Product />} />
          <Route path="/produto/:id" element={<Product />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/favoritos" element={<RequireAuth><FavoritesPage /></RequireAuth>} />
          <Route
            path="/administracao"
            element={
              <RequireRole>
                <Administration />
              </RequireRole>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="produtos" element={<AdminProducts />} />
            <Route path="promocoes" element={<AdminSection kind="promocoes" />} />
            <Route path="pedidos" element={<AdminSection kind="pedidos" />} />
          </Route>
          <Route path="*" element={<section className="page"><h1>Página não encontrada</h1><p>Use o menu para continuar navegando pela FORMA.</p></section>} />
          <Route
            path="/minha-conta"
            element={
              <RequireAuth>
                <AccountLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Overview />} />
            <Route path="pedidos" element={<Orders />} />
            <Route path="pedidos/:id" element={<OrderDetail />} />
            <Route path="favoritos" element={<Favorites />} />
            <Route path="listas" element={<Lists />} />
            <Route path="listas/:id" element={<ListDetail />} />
            <Route path="enderecos" element={<Addresses />} />
            <Route path="cartoes" element={<Cards />} />
            <Route path="dados" element={<Account />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
