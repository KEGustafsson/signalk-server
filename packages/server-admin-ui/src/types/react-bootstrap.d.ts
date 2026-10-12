import 'react-bootstrap/TabContainer'
import type { ReactNode } from 'react'

// react-bootstrap 2.x derives TabContainerProps from @restart/ui's TabsProps
// via `Omit<TabsProps, 'transition'>`, which drops the inherited `children`
// under @types/react 19. Restore it so <Tab.Container> accepts children.
declare module 'react-bootstrap/TabContainer' {
  interface TabContainerProps {
    children?: ReactNode
  }
}
