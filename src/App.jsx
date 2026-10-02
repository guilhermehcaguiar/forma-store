import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import About from './pages/About'
import Cart from './pages/Cart'
import Auth from './pages/Auth'

function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/carrinho" element={<Cart />} />
          <Route path="/login" element={<Auth />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
