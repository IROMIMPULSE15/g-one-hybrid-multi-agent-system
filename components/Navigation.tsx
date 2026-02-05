"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import UserProfile from "@/components/UserProfile"
import FeatureModal from "@/components/FeatureModal"

const navItems = [
  {
    name: "Features",
    href: "/features",
    submenu: [
      { name: "Voice Recognition", href: "#voice", feature: "voice" },
      { name: "AI Processing", href: "#ai", feature: "ai" },
      { name: "Analytics", href: "#analytics", feature: "analytics" },
    ],
  },
  { name: "Demo", href: "/demo" },
  { name: "Use Cases", href: "/use-cases" },
  { name: "Pricing", href: "/pricing" },
  {
    name: "Resources",
    href: "/resources",
    submenu: [
      { name: "Documentation", href: "/resources#documentation" },
      { name: "API Reference", href: "/resources#api" },
      { name: "Support", href: "/resources#support" },
    ],
  },
  { name: "Contact", href: "/contact" },
]

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const { data: session, status } = useSession()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleFeatureClick = (feature: string) => {
    setSelectedFeature(feature)
    setActiveSubmenu(null)
    setIsOpen(false)
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/20 backdrop-blur-md border-b border-white/10" : "bg-transparent"
          }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="text-white font-bold text-xl">CIA Agent</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {navItems.map((item) => (
                <div
                  key={item.name}
                  className="relative"
                  onMouseEnter={() => item.submenu && setActiveSubmenu(item.name)}
                  onMouseLeave={() => setActiveSubmenu(null)}
                >
                  <Link
                    href={item.href}
                    className="text-gray-300 hover:text-white transition-colors duration-200 flex items-center space-x-1"
                  >
                    <span>{item.name}</span>
                    {item.submenu && <ChevronDown className="w-4 h-4" />}
                  </Link>

                  {/* Submenu */}
                  <AnimatePresence>
                    {item.submenu && activeSubmenu === item.name && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 mt-2 w-48 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg shadow-xl"
                      >
                        {item.submenu.map((subItem) => (
                          <button
                            key={subItem.name}
                            onClick={() => ("feature" in subItem && subItem.feature ? handleFeatureClick(subItem.feature) : null)}
                            className="block w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg"
                          >
                            {subItem.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden lg:flex items-center space-x-4">
              {status === 'loading' ? (
                <div className="text-gray-300">Loading...</div>
              ) : session ? (
                <UserProfile />
              ) : (
                <>
                  <Link href="/auth/login">
                    <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10">
                      Log In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden text-white p-2">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="lg:hidden bg-black/90 backdrop-blur-md border-t border-white/10"
              >
                <div className="py-4 space-y-2">
                  {navItems.map((item) => (
                    <div key={item.name}>
                      <Link
                        href={item.href}
                        className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-200"
                        onClick={() => setIsOpen(false)}
                      >
                        {item.name}
                      </Link>
                      {item.submenu && (
                        <div className="pl-4">
                          {item.submenu.map((subItem) => (
                            <button
                              key={subItem.name}
                              onClick={() => ("feature" in subItem && subItem.feature ? handleFeatureClick(subItem.feature) : null)}
                              className="block w-full text-left px-4 py-1 text-gray-400 hover:text-white hover:bg-white/5 transition-colors duration-200 text-sm"
                            >
                              {subItem.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="px-4 py-2 space-y-2">
                    {status !== 'loading' && (
                      <>
                        {session?.user ? (
                          <div className="text-white">Welcome, {session.user.name}!</div>
                        ) : (
                          <>
                            <Link href="/auth/login" onClick={() => setIsOpen(false)}>
                              <Button
                                variant="ghost"
                                className="w-full text-gray-300 hover:text-white hover:bg-white/10"
                              >
                                Log In
                              </Button>
                            </Link>
                            <Link href="/auth/signup" onClick={() => setIsOpen(false)}>
                              <Button className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white">
                                Sign Up
                              </Button>
                            </Link>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* Feature Modal */}
      <FeatureModal isOpen={!!selectedFeature} onClose={() => setSelectedFeature(null)} feature={selectedFeature} />
    </>
  )
}
