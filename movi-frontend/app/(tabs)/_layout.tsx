import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
   const colorScheme = useColorScheme();

   return (
      <Tabs
         initialRouteName='home'
         screenOptions={{
            tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
            headerShown: false,
            tabBarButton: HapticTab,
         }}
      >
         <Tabs.Screen
            name='home'
            options={{
               title: 'Home',
               tabBarIcon: ({ color }) => (
                  <IconSymbol size={28} name='house.fill' color={color} />
               ),
            }}
         />
         <Tabs.Screen
            name='library'
            options={{
               title: 'Library',
               tabBarIcon: ({ color }) => (
                  <IconSymbol
                     size={28}
                     name='books.vertical.fill'
                     color={color}
                  />
               ),
            }}
         />
         <Tabs.Screen
            name='search'
            options={{
               title: 'Search',
               tabBarIcon: ({ color }) => (
                  <IconSymbol
                     size={28}
                     name='magnifyingglass.circle.fill'
                     color={color}
                  />
               ),
            }}
         />
         <Tabs.Screen
            name='profile'
            options={{
               title: 'Profile',
               tabBarIcon: ({ color }) => (
                  <IconSymbol size={28} name='person.fill' color={color} />
               ),
            }}
         />
         <Tabs.Screen
            name='book'
            options={{
               title: 'Book',
               tabBarIcon: ({ color }) => (
                  <IconSymbol size={28} name='bookmark.fill' color={color} />
               ),
            }}
         />
      </Tabs>
   );
}
