{ api for Mobile search

  api/search/?q=&category=Mobile+App&file=&brand=&product_type=&min_price=1&max_price=10000&page=1

}
{ Api for Website search 

   api/search/?q=&category=Website&file=&brand=&product_type=&min_price=1&max_price=10000&page=1
}
{ Api for listing all mobile design. 
 /api/search/?q=&category=Mobile+App&file=&brand=&product_type=&min_price=1&max_price=10000&page=1
}
{
   Api for listing all website design
   api/search/?q=&category=Website&file=&brand=&product_type=&min_price=1&max_price=10000&page=1
}
{ api for Mobile app category tab

  api/category/

}
{ Api for Adding product  to editory   

   api/add-to-editory/  

}
{ api for Editory list/

   api/editory-list/
}
{ api for Editting Editories

  api/editories/<id>/

}
{api for  Updating Edittory

   api/update-editory/<id>/edit/

}
{api for Viewing  cart 

   api/view-cart/
}
{ api for Adding product to cart

   api/add-to-cart/

}
{ api for payment Checkout
   api/checkout/?payment_type=wallet&currency=USDTTRC20
}
{ api for listing all Orders

   api/customer_orders_&_cancel/

}
{ api for listing all my wallets and ballance

  api/wallets/

}
{api for  Deployed project list

  api/deploy/projects/list/

}

{ api for Plans Upgrading

   api/plans/purchase/

}



{api for listting card

  api/cards/

}



{api for  funding wallet 

  api/fund/card/initiate/

}



{ api for saving cards

  api/cards/save/

}



{ api for creating  new wallet 

  api/wallets/create/

}




flow steps {
   ElevenLabs(speach to text) -> backend websocket -> cloude ai(LLM) the brain makes decesion if its anything that has to do with ideas or thinking plans or making plans or puting plans together and the making a step by step action list(json) and return it to the mobile as a list and a speach back to them and if it anything to has to do with there logo creation or need logo etc let the cloude generate and return to them with the imade and speach back to send to the mobile. but if its as anything to do with web or mobile app development or design it the follow this flow (
      first get the type of web or mobile app they wont or in general what kind business they wont to run or already have(from the speach to text to coude ai to get the name) once you get the name then use the name to call this api or there functions of the api directly from the backend any that is more faster to return response { Api for listing all mobile design. 
 /api/search/?q=&category=Mobile+App&file=&brand=&product_type=&min_price=1&max_price=10000&page=1
} then return the speach and response of the result back to the mobile if it mobile { Api for listing all mobile design. 
 /api/search/?q=&category=Mobile+App&file=&brand=&product_type=&min_price=1&max_price=10000&page=1
} if its web {
   Api for listing all website design
   api/search/?q=&category=Website&file=&brand=&product_type=&min_price=1&max_price=10000&page=1
} then in the mobile list it in the DesignGalleryPopup.tsx and make the popup to show and they cant cancle or close it ontil they select so they select and if you can find a way to listing or get when they click the add to editory { Api for Adding product  to editory   

   api/add-to-editory/  

} from the mobile then you return a response if they wont to add more or proceed if they say proceed then close the popup and call the Editory list { api for Editory list/

   api/editory-list/
} then check if the list inside is more than one item if just one item then call the Updating Edittory and pass the id of that one {api for  Updating Edittory (put)

   api/update-editory/<id>/edit/

} this the payload to send specifications
type
mobile
need_team
product_status
published
status
Individual
sku
sku-1788005660633-102
front_end_lan
back_end_lan
domain_name
apsuni.com
domain
domain_extension
.com
domain_price
30000
ios
false
price
8.99
android
false
play_store
false
app_store
false
apsuni_play_store
false
apsuni_app_store
false
allow_usage
git_url
apsuni.com
llc
llc_price
0
front_end_framw
back_end_framw
server_type
server_size
testing_server
false
hosting_provider
hosting_plan
team_no
company_type
company_for
company_email
company_phone
company_address
project_name
Messenger Chat App
company_country
company_state
company_faxline
company_whatapp
country_code
instagram
twitter
facebook
total_amount
8.99
project_type
Mobile App
base_total
8.99
company_logo
(binary)
shared_with_ids
2
shared_with_ids
3 but only ask and fill the very important ones so let the elevenlab always ask the user in the mobile for the details as the user is talking its filling the details like only ask the import once the fill and submit or if you think chating is ok then connect to the chat as the ai is asking you are responding instantly to the chat in VoiceAssessmentScreen so do the two but ask first the user which is ok with him guiding him throug voice or chat if he says voicee then continue with using voice to ask and fill the form behide in the hidden then submit when done so if example also for the logo when you ask him if he has a logo if he says yes then open the chat automatically and tell him to upload it from the chat once he uploads it add to the form and close the chat popup and continue asking for other infomation or you can ask for others and leave the logo for last but if he say no he dont have logo the flow the logo flow above and pass the logo in the chat base on the company name , if all done and subited and you check its successful the add to cart automaticaly api for Adding product to cart { 

   api/add-to-cart/

} 
and then use this to be sure its added in the cart check the list cart {api for Viewing  cart 

   api/view-cart/
} and also show them all the item added to the cart and there pice and total price in the chat or a customize popup you create and list it if the user says ok then proceed if all is good then run the payment by running the payment api { api for payment Checkout
   api/checkout/?payment_type=wallet&currency=
} if issue like wallet empty wallet or anyother issue let them know by saying it if all is good take them to the order page in the mobile and also say your project is processing well done . so important stuff to ask and fill the form are type
mobile
need_team
domain_name
play_store (need it to be deployed in play_store)
app_store (need it to be deployed in app store)
llc
testing_server
company_type
company_email
project_name
instagram
twitter
facebook
project_type
company_logo
   ) and also always return the speach(elevenlab text to speach) and response(json) back to the mobile -> ElevenLabs(text to speach) -> backend websocket (speach and also a json response of there request) -> mobile(to respond back the speach and also show there request to the in the ui).  in all this the the speach retuended back to the should match what the response(json) to them
}