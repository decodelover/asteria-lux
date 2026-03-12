import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getOrCreateSessionId } from '../lib/session'
import { StoreContext } from './store-context'

const createEmptyCart = (sessionId) => ({
  sessionId,
  items: [],
  summary: {
    freeShippingThreshold: 15000,
    itemCount: 0,
    shippingFee: 0,
    subtotal: 0,
    total: 0,
  },
})

export function StoreProvider({ children }) {
  const [sessionId] = useState(() => getOrCreateSessionId())
  const [cart, setCart] = useState(() => createEmptyCart(sessionId))
  const [cartLoading, setCartLoading] = useState(true)
  const [busyKey, setBusyKey] = useState(null)
  const [paymentConfig, setPaymentConfig] = useState({
    bankTransfer: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      enabled: true,
      instructions: '',
      maxProofSizeMb: 5,
      proofTypes: [],
    },
    currency: 'NGN',
    paystack: {
      enabled: false,
      publicKey: null,
    },
  })

  const refreshCart = async () => {
    const response = await api.getCart(sessionId)
    setCart(response.cart)
    return response.cart
  }

  const refreshPaymentConfig = async () => {
    const response = await api.getPaymentConfig()
    setPaymentConfig(response.paymentConfig)
    return response.paymentConfig
  }

  useEffect(() => {
    let ignore = false

    const loadCart = async () => {
      setCartLoading(true)

      try {
        const nextCart = await api.getCart(sessionId)

        if (!ignore) {
          setCart(nextCart.cart)
        }
      } catch {
        if (!ignore) {
          setCart(createEmptyCart(sessionId))
        }
      } finally {
        if (!ignore) {
          setCartLoading(false)
        }
      }
    }

    loadCart()

    return () => {
      ignore = true
    }
  }, [sessionId])

  useEffect(() => {
    refreshPaymentConfig().catch(() => {})
  }, [])

  const addToCart = async (productId, quantity = 1) => {
    setBusyKey(productId)

    try {
      const response = await api.addToCart({
        productId,
        quantity,
        sessionId,
      })
      setCart(response.cart)
      return response
    } finally {
      setBusyKey(null)
    }
  }

  const changeQuantity = async (productId, quantity) => {
    setBusyKey(productId)

    try {
      const response =
        quantity <= 0
          ? await api.removeCartItem(sessionId, productId)
          : await api.updateCartItem({
              productId,
              quantity,
              sessionId,
            })

      setCart(response.cart)
      return response
    } finally {
      setBusyKey(null)
    }
  }

  const clearCart = async () => {
    setBusyKey('cart')

    try {
      const response = await api.clearCart(sessionId)
      setCart(response.cart)
      return response
    } finally {
      setBusyKey(null)
    }
  }

  const checkout = async ({ customer, notes, token }) => {
    setBusyKey('checkout')

    try {
      const response = await api.checkout(
        {
          customer,
          notes,
          sessionId,
        },
        token,
      )
      setCart(createEmptyCart(sessionId))
      return response
    } finally {
      setBusyKey(null)
    }
  }

  const initializePaystackCheckout = async ({ customer, notes, token }) => {
    setBusyKey('checkout')

    try {
      return await api.initializePaystackPayment(
        {
          customer,
          notes,
          sessionId,
        },
        token,
      )
    } finally {
      setBusyKey(null)
    }
  }

  const verifyPaystackCheckout = async ({ reference, token }) => {
    setBusyKey('checkout')

    try {
      const response = await api.verifyPaystackPayment({ reference }, token)
      setCart(createEmptyCart(sessionId))
      return response
    } finally {
      setBusyKey(null)
    }
  }

  const submitBankTransfer = async ({ customer, notes, proofFile, token }) => {
    setBusyKey('checkout')

    try {
      const formData = new FormData()
      formData.append('sessionId', sessionId)
      formData.append('name', customer.name)
      formData.append('email', customer.email)
      formData.append('phone', customer.phone || '')
      formData.append('country', customer.country)
      formData.append('city', customer.city)
      formData.append('address', customer.address)
      formData.append('notes', notes || '')
      formData.append('proof', proofFile)

      const response = await api.submitBankTransfer(formData, token)
      setCart(createEmptyCart(sessionId))
      return response
    } finally {
      setBusyKey(null)
    }
  }

  const amountToFreeShipping = useMemo(
    () => Math.max(cart.summary.freeShippingThreshold - cart.summary.subtotal, 0),
    [cart.summary.freeShippingThreshold, cart.summary.subtotal],
  )

  return (
    <StoreContext.Provider
      value={{
        addToCart,
        amountToFreeShipping,
        busyKey,
        cart,
        cartLoading,
        changeQuantity,
        checkout,
        clearCart,
        initializePaystackCheckout,
        paymentConfig,
        refreshCart,
        refreshPaymentConfig,
        sessionId,
        submitBankTransfer,
        verifyPaystackCheckout,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
